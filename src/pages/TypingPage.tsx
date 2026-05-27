// Adapted from qwerty-learner
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useIsMobile } from '../lib/useIsMobile'
import WordComponent, { type WordResult } from '../engine/typing/WordComponent'
import { usePronunciation } from '../engine/pronunciation/usePronunciation'
import { useKeySounds } from '../engine/pronunciation/useKeySounds'
import { Chevron } from '../components/Icons'
import { db } from '../engine/db'
import { markTodayCheckin } from '../lib/typingProtocol'

import devWork from '../data/dictionaries/dev-work.json'
import cet4 from '../data/dictionaries/cet4.json'
import becWork from '../data/dictionaries/bec-work.json'

interface DictEntry {
  name: string; trans: string[]; usphone?: string; ukphone?: string; scene?: string
}
const DICTIONARIES: Record<string, { label: string; zh: string; entries: DictEntry[] }> = {
  'dev-work': { label: 'Dev Work', zh: '开发者高频词', entries: devWork as DictEntry[] },
  cet4: { label: 'CET-4', zh: '大学英语四级', entries: cet4 as DictEntry[] },
  'bec-work': { label: 'BEC Work', zh: '商务英语', entries: becWork as DictEntry[] },
}
const DICT_KEYS = Object.keys(DICTIONARIES)
const PERSONAL_DICT_KEY = '__personal__'
const BATCH_OPTIONS = [5, 10, 20]
type TypingMode = 'follow' | 'dictation'

export default function TypingPage() {
  const [searchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const [dictKey, setDictKey] = useState<string>('dev-work')
  const [showDictPicker, setShowDictPicker] = useState(false)
  const [batchSize, setBatchSize] = useState(10)
  const [showBatchPicker, setShowBatchPicker] = useState(false)
  const [mode, setMode] = useState<TypingMode>('follow')

  // ── Personal dictionary (Dexie-backed) ──
  const [personalEntries, setPersonalEntries] = useState<DictEntry[]>([])
  const [personalLoading, setPersonalLoading] = useState(false)
  // FIX: ref so switchDict can always read the latest entries without stale closure
  const personalEntriesRef = useRef<DictEntry[]>([])

  const loadPersonalDict = useCallback(async () => {
    setPersonalLoading(true)
    const cards = await db.flashcards.orderBy('createdAt').reverse().toArray()
    const mapped = cards.map(c => ({
      name: c.word,
      trans: [c.definition || ''],
      usphone: c.ipa,
      ukphone: c.ipa,
      scene: 'personal',
    }))
    personalEntriesRef.current = mapped
    setPersonalEntries(mapped)
    setPersonalLoading(false)
  }, [])

  // Preload personal dict in background so it's ready when user switches
  useEffect(() => { loadPersonalDict() }, [loadPersonalDict])

  const isPersonal = dictKey === PERSONAL_DICT_KEY
  const entries = isPersonal ? personalEntries : DICTIONARIES[dictKey].entries
  // FIX: memoize to avoid identity change on every render (caused useCallback re-creation)
  const rawWords = useMemo(() => entries.map(e => e.name), [entries])
  const totalBatches = Math.max(1, Math.ceil(rawWords.length / batchSize))

  // ── Queue-based batch engine ──
  type QueueEntry = { name: string; idx: number }
  const makeEntry = (name: string, idx: number): QueueEntry => ({ name, idx })

  const [batchIndex, setBatchIndex] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const [workQueue, setWorkQueue] = useState<QueueEntry[]>([])
  const [queuePos, setQueuePos] = useState(0)
  const [batchPhase, setBatchPhase] = useState<'typing' | 'retrying' | 'complete'>('complete')
  const [wrongsThisWord, setWrongsThisWord] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [wordResults, setWordResults] = useState<WordResult[]>([])
  const errorSetRef = useRef<Set<number>>(new Set())
  // Mobile: hidden input keeps virtual keyboard open while typing is active
  // Note: batchPhase/allDone used directly here — isTyping is derived after this block
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  const currentQEntry = workQueue[queuePos]
  const currentEntryIdx = currentQEntry?.idx ?? 0
  const currentEntry = entries[currentEntryIdx] || entries[0]
  const currentWord = currentEntry?.name || ''
  const currentIpa = currentEntry?.usphone || currentEntry?.ukphone || ''
  const currentTrans = currentEntry?.trans?.[0] || ''
  const isTyping = batchPhase !== 'complete' && !allDone

  // Mobile virtual keyboard: focus hidden input when typing starts so the keyboard stays open
  useEffect(() => {
    if (isMobile && isTyping) {
      const t = setTimeout(() => hiddenInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [isMobile, isTyping])

  const { playPronunciation } = usePronunciation()
  const { playCorrect, playWrong, playComplete } = useKeySounds()

  // Auto-pronounce
  useEffect(() => {
    if (currentWord) {
      setShowAnswer(false)
      setWrongsThisWord(0)
      const timer = setTimeout(() => playPronunciation(currentWord), 200)
      return () => clearTimeout(timer)
    }
  }, [currentWord, playPronunciation])

  const replay = useCallback(() => { if (currentWord) playPronunciation(currentWord) }, [currentWord, playPronunciation])

  // ── Start batch from given batch index ──
  const startBatch = useCallback((bIdx: number, wordList: string[]) => {
    if (wordList.length === 0) {
      setWorkQueue([]); setQueuePos(0); setBatchPhase('complete'); setAllDone(false)
      return
    }
    const total = Math.ceil(wordList.length / batchSize)
    const safeIdx = Math.min(bIdx, total - 1)
    const slice = wordList.slice(safeIdx * batchSize, (safeIdx + 1) * batchSize)
    const q = slice.map((name, i) => makeEntry(name, safeIdx * batchSize + i))
    setWorkQueue(q); setQueuePos(0); setBatchPhase('typing'); setAllDone(false)
    setShowAnswer(false); setWrongsThisWord(0); setWordResults([])
    errorSetRef.current = new Set()
  }, [batchSize])

  // (personalEntriesRef keeps switchDict in sync; no pendingBatch workaround needed)

  // ── Switch dict ──
  const switchDict = useCallback(async (key: string) => {
    setDictKey(key)
    setShowDictPicker(false)
    setBatchIndex(0)
    setAllDone(false)

    let wordList: string[]
    if (key === PERSONAL_DICT_KEY) {
      await loadPersonalDict()
      // FIX: read from ref, not state — state update from loadPersonalDict is async
      // and personalEntries in this closure is stale (captured at useCallback creation)
      wordList = personalEntriesRef.current.map(e => e.name)
    } else {
      wordList = DICTIONARIES[key].entries.map(e => e.name)
    }

    startBatch(0, wordList)
  }, [loadPersonalDict, startBatch])

  // ── URL param auto-start ──
  useEffect(() => {
    if (searchParams.get('start') === 'personal') {
      // Wait briefly for personal entries to load, then switch
      const timer = setTimeout(() => switchDict(PERSONAL_DICT_KEY), 300)
      return () => clearTimeout(timer)
    }
  }, [searchParams, switchDict])

  // ── Advance in queue ──
  const advanceInQueue = useCallback((newResult: WordResult) => {
    setWordResults(prev => [...prev, newResult])
    if (newResult.wrongCount > 0) errorSetRef.current.add(currentQEntry!.idx)

    const nextPos = queuePos + 1
    if (nextPos >= workQueue.length) {
      const errors = [...errorSetRef.current]
      errorSetRef.current = new Set()
      if (errors.length > 0) {
        const correctWords = workQueue.filter(q => !errors.includes(q.idx))
        const errorWords = workQueue.filter(q => errors.includes(q.idx)).sort(() => Math.random() - 0.5)
        setWorkQueue([...correctWords, ...errorWords])
        setQueuePos(correctWords.length)
        setBatchPhase('retrying')
        setShowAnswer(false); setWrongsThisWord(0)
      } else {
        setBatchPhase('complete')
        // 通关打卡
        markTodayCheckin()
      }
    } else {
      setQueuePos(nextPos)
    }
  }, [queuePos, workQueue, currentQEntry])

  const handleFinish = useCallback((result: WordResult) => { advanceInQueue(result) }, [advanceInQueue])

  const handleWrongChar = useCallback(() => {
    playWrong()
    setWrongsThisWord(prev => {
      const next = prev + 1
      if (next >= 3 && mode === 'dictation' && !showAnswer) setShowAnswer(true)
      return next
    })
  }, [mode, showAnswer, playWrong])

  const goNextBatch = useCallback(() => {
    const next = batchIndex + 1
    if (next >= totalBatches) { setAllDone(true); return }
    setBatchIndex(next)
    startBatch(next, rawWords)
  }, [batchIndex, totalBatches, startBatch, rawWords])

  const reset = useCallback(() => {
    setBatchIndex(0); setAllDone(false)
    startBatch(0, rawWords)
  }, [startBatch, rawWords])

  // NOTE: useKeyHandler is intentionally not called here — WordComponent handles
  // its own key capture internally. This hook is used by standalone typing engines
  // that need to intercept keystrokes outside of a WordComponent.

  // Stats
  const totalCorrect = wordResults.reduce((s, r) => s + r.correctCount, 0)
  const totalWrong = wordResults.reduce((s, r) => s + r.wrongCount, 0)
  const accuracy = totalCorrect + totalWrong > 0
    ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100) : 100

  // ── Render helpers ──
  const totalWordsInBatch = rawWords.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize).length
  const isFromStatic = dictKey in DICTIONARIES
  const dictLabel = isPersonal
    ? { label: 'My Vocabulary', zh: `个人场景词库 · ${personalEntries.length} cards` }
    : { label: DICTIONARIES[dictKey].label, zh: `${DICTIONARIES[dictKey].zh} · ${DICTIONARIES[dictKey].entries.length} words` }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20,
      maxWidth: 800, margin: '0 auto',
      padding: isMobile ? '14px 14px 200px' : 'var(--page-pad) var(--page-pad) 60px',
    }}>
      {/* Mobile: hidden input to keep virtual keyboard open */}
      {isMobile && (
        <input
          ref={hiddenInputRef}
          readOnly
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: 'fixed', top: 0, left: 0,
            width: 1, height: 1, opacity: 0,
            fontSize: 16, // prevents iOS auto-zoom
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ======== Header ======== */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? 10 : 0,
      }}>
        <div>
          <h2 className="de-h2" style={{ fontSize: isMobile ? 17 : undefined }}>
            {mode === 'dictation' ? '🙈 默写模式' : '👀 跟打模式'}
          </h2>
          <p className="de-zh" style={{ marginTop: 4, fontSize: isMobile ? 12 : undefined }}>
            {isMobile
              ? (isPersonal ? `My Vocab · ${personalEntries.length} 词` : `${DICTIONARIES[dictKey]?.zh ?? ''} · ${rawWords.length} 词`)
              : dictLabel.zh}
          </p>
        </div>
        {/* Controls row — wraps on mobile */}
        <div style={{
          display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'flex-start' : undefined,
        }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 999, padding: 2 }}>
            {(['follow', 'dictation'] as TypingMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  padding: isMobile ? '5px 10px' : '6px 14px',
                  borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: mode === m ? 'var(--card)' : 'transparent',
                  color: mode === m ? 'var(--blue-deep)' : 'var(--ink-3)',
                  fontWeight: mode === m ? 600 : 500,
                  fontSize: isMobile ? 13 : 12,
                  fontFamily: 'var(--font-sans)',
                  boxShadow: mode === m ? 'var(--shadow-1)' : 'none',
                }}>
                {isMobile
                  ? (m === 'follow' ? '👀' : '🙈')
                  : (m === 'follow' ? '👀 跟打' : '🙈 默写')}
              </button>
            ))}
          </div>
          {/* Batch size */}
          <div style={{ position: 'relative' }}>
            <button className="de-btn" onClick={() => setShowBatchPicker(p => !p)}
              style={{ fontSize: 12, padding: isMobile ? '0 10px' : '0 12px', height: isMobile ? 30 : 34 }}>
              {batchSize}/组 ▾
            </button>
            {showBatchPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowBatchPicker(false)} />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 10,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-3)', minWidth: 120, padding: 6,
                }}>
                  {BATCH_OPTIONS.map(n => (
                    <button key={n} onClick={() => { setBatchSize(n); setShowBatchPicker(false); reset() }}
                      style={{
                        display: 'block', width: '100%', padding: '8px 14px', border: 'none',
                        background: n === batchSize ? 'var(--blue-soft)' : 'transparent',
                        color: n === batchSize ? 'var(--blue-deep)' : 'var(--ink)',
                        borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                      }}>
                      {n} words
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Dict picker */}
          <div style={{ position: 'relative' }}>
            <button className="de-btn" onClick={() => setShowDictPicker(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, padding: isMobile ? '0 10px' : '0 12px',
                height: isMobile ? 30 : 34,
                maxWidth: isMobile ? 120 : undefined,
              }}>
              <span className="de-mono" style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: isMobile ? 72 : undefined,
              }}>
                {dictLabel.label}
              </span>
              <Chevron size={12} color="var(--ink-3)" />
            </button>
            {showDictPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowDictPicker(false)} />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 10,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-3)',
                  minWidth: isMobile ? 180 : 220, padding: 6,
                }}>
                  {[...DICT_KEYS, PERSONAL_DICT_KEY].map(key => {
                    const isPers = key === PERSONAL_DICT_KEY
                    const info = isPers
                      ? { label: 'My Vocabulary', zh: `个人场景 · ${personalEntries.length} cards` }
                      : { label: DICTIONARIES[key].label, zh: `${DICTIONARIES[key].zh} · ${DICTIONARIES[key].entries.length} words` }
                    return (
                      <button key={key} onClick={() => switchDict(key)}
                        style={{
                          display: 'block', width: '100%', padding: '10px 14px', border: 'none',
                          background: key === dictKey ? 'var(--blue-soft)' : 'transparent',
                          color: key === dictKey ? 'var(--blue-deep)' : 'var(--ink)',
                          borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                        }}>
                        <div style={{ fontWeight: 600 }}>{info.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{info.zh}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <button className="de-btn" onClick={reset}
            style={{ fontSize: 14, padding: isMobile ? '0 10px' : '0 12px', height: isMobile ? 30 : 34 }}>
            ↻
          </button>
        </div>
      </div>

      {/* ======== Progress bar ======== */}
      {(batchPhase === 'typing' || batchPhase === 'retrying') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="de-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            第{batchIndex + 1}/{totalBatches}组
            {batchPhase === 'retrying' && ' 🔄 错题复习'}
          </span>
          <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (queuePos / Math.max(1, workQueue.length)) * 100)}%`,
              background: batchPhase === 'retrying'
                ? 'linear-gradient(90deg, var(--peach), var(--gold))'
                : 'linear-gradient(90deg, var(--blue), var(--mint))',
              borderRadius: 999, transition: 'width 0.3s ease',
            }} />
          </div>
          <span className="de-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {queuePos}/{workQueue.length}
          </span>
        </div>
      )}

      {/* ======== Main content ======== */}
      {allDone ? (
        <div className="de-card" style={{ padding: isMobile ? 24 : 40, textAlign: 'center', minHeight: isMobile ? 200 : 250 }}>
          <div style={{ fontSize: isMobile ? 40 : 48, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, marginBottom: 8 }}>全部完成！</div>
          <div style={{ color: 'var(--ink-3)', fontSize: isMobile ? 13 : undefined }}>
            {rawWords.length} 词 · 正确率 {accuracy}% · 正确 {totalCorrect} · 错误 {totalWrong}
          </div>
          <button className="de-btn primary" onClick={reset} style={{ marginTop: 20 }}>↻ 再来一次</button>
        </div>
      ) : batchPhase === 'complete' || workQueue.length === 0 ? (
        <div className="de-card" style={{ padding: isMobile ? 24 : 40, textAlign: 'center', minHeight: isMobile ? 200 : 250, background: 'linear-gradient(180deg, #fff 0%, #fbfaf6 100%)' }}>
          <div style={{ fontSize: isMobile ? 32 : 40, marginBottom: 12 }}>
            {rawWords.length === 0 && isPersonal ? '📝' : '✅'}
          </div>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 600, marginBottom: 4 }}>
            {rawWords.length === 0 && isPersonal
              ? '个人词库还没有词'
              : `第${batchIndex + 1}组 · 全部通关！`}
          </div>
          <div style={{ color: 'var(--ink-3)', marginBottom: 20 }}>
            {rawWords.length === 0 && isPersonal
              ? '去 Dashboard 搜词添加，然后回到这里练习'
              : `${totalWordsInBatch} 词全对 · 正确率 ${accuracy}%`}
          </div>
          {rawWords.length === 0 && isPersonal ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              在 Dashboard 输入单词，点击 Add to Cards
            </div>
          ) : batchIndex + 1 < totalBatches ? (
            <button className="de-btn primary" onClick={goNextBatch}
              style={{ fontSize: 16, padding: '12px 32px', height: 'auto' }}>
              下一组 →
            </button>
          ) : (
            <button className="de-btn primary" onClick={() => { setBatchIndex(0); startBatch(0, rawWords) }}
              style={{ fontSize: 16, padding: '12px 32px', height: 'auto' }}>
              从头再来 →
            </button>
          )}
        </div>
      ) : (
        <div className="de-card" style={{
          padding: isMobile ? 20 : 32,
          minHeight: isMobile ? 220 : 260,
          background: 'linear-gradient(180deg, #fff 0%, #fbfaf6 100%)',
        }}>
          {/* Dots */}
          <div style={{ display: 'flex', gap: isMobile ? 4 : 6, justifyContent: 'center', marginBottom: isMobile ? 12 : 16, flexWrap: 'wrap' }}>
            {workQueue.slice(0, 30).map((_, i) => (
              <span key={i} style={{
                width: isMobile ? 18 : 24, height: isMobile ? 3 : 4, borderRadius: 999,
                background: i < queuePos ? 'var(--green)' : i === queuePos ? 'var(--blue)' : 'var(--surface-2)',
              }} />
            ))}
          </div>

          {/* Word info */}
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 16 : 24 }}>
            {currentIpa && (
              <div className="de-mono" style={{ fontSize: isMobile ? 12 : 13, color: 'var(--ink-3)', marginBottom: 6 }}>
                {currentIpa}
              </div>
            )}
            {mode === 'follow' ? (
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink)', marginBottom: 4 }}>
                {currentWord}
              </div>
            ) : showAnswer ? (
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--peach-deep)', marginBottom: 4 }}>
                💡 {currentWord}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 3 : 4, marginBottom: 4, flexWrap: 'wrap' }}>
                {currentWord.split('').map((_, i) => (
                  <span key={i} style={{
                    display: 'inline-block',
                    width: isMobile ? 11 : 14,
                    height: isMobile ? 16 : 20,
                    borderBottom: '2px solid var(--ink-mute)', margin: '0 1px',
                  }} />
                ))}
              </div>
            )}
            {currentTrans && (
              <div style={{ fontSize: isMobile ? 13 : 14, color: 'var(--ink-2)', marginTop: 4 }}>{currentTrans}</div>
            )}
            {mode === 'dictation' && wrongsThisWord > 0 && !showAnswer && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--peach-deep)' }}>
                {wrongsThisWord >= 3 ? '💡 答案已显示' : `❌ ${wrongsThisWord}/3 错`}
              </div>
            )}
          </div>

          {/* Typing area */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, fontFamily: 'var(--font-mono)', marginBottom: isMobile ? 16 : 24 }}>
              <WordComponent
                word={currentWord} isTyping={isTyping}
                onFinish={handleFinish}
                onCorrectChar={playCorrect} onWrongChar={handleWrongChar} onWordComplete={playComplete}
                ignoreCase
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
              <button className="de-btn ghost" onClick={replay}
                style={{ fontSize: isMobile ? 13 : 12, color: 'var(--blue-deep)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                🔊 再听一遍
              </button>
              <span className="de-mono de-muted" style={{ fontSize: 11 }}>
                第 {queuePos + 1}/{workQueue.length} 词
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {wordResults.length > 0 && batchPhase !== 'complete' && !allDone && (
        <div className="de-card de-card-pad" style={{ display: 'flex', gap: isMobile ? 16 : 24 }}>
          <div><div className="de-eyebrow">正确率</div>
            <div className="de-mono" style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, color: accuracy >= 80 ? 'var(--green-deep)' : 'var(--peach-deep)' }}>
              {accuracy}%
            </div>
          </div>
          <div><div className="de-eyebrow">正确</div>
            <div className="de-mono" style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, color: 'var(--mint-deep)' }}>{totalCorrect}</div>
          </div>
          <div><div className="de-eyebrow">错误</div>
            <div className="de-mono" style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, color: 'var(--peach-deep)' }}>{totalWrong}</div>
          </div>
          {batchPhase === 'retrying' && (
            <div><div className="de-eyebrow">待复习</div>
              <div className="de-mono" style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, color: 'var(--gold)' }}>
                {workQueue.length - queuePos}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
