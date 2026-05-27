import React, { useState, useCallback, useRef } from 'react'
import { Volume, Star, Mic, Refresh, Sparkles, Check, Flip } from './Icons'
import { useSpeech } from '../engine/pronunciation/useSpeech'
import type { ScenarioExamples } from '../lib/translate'
import { assessPronunciation } from '../lib/speechAssessment'
import type { AssessmentResult } from '../lib/speechAssessment'
import { useIsMobile } from '../lib/useIsMobile'

export interface IntegratedCardData {
  word: string
  ipa?: string
  partOfSpeech?: string
  definition: string
  example?: string
  exampleZh?: string
  type?: 'word' | 'sentence'
}

const DEFAULT_CARD: IntegratedCardData = {
  word: 'Repository',
  ipa: '/rɪˈpɒz.ɪ.tər.i/',
  partOfSpeech: 'noun',
  definition: '代码仓库 — 存放项目源代码和历史版本的中央位置。',
  example: 'Failed to push some refs to git repository.',
  exampleZh: '推送某些引用到 Git 仓库失败。',
  type: 'word',
}

interface IntegratedCardProps {
  wide?: boolean
  card?: IntegratedCardData
  /** 三场景例句缓存（单词模式查词时由 translate 返回） */
  scenarios?: ScenarioExamples
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 90, fontSize: 12, color: 'var(--ink-2)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${value}%`,
          background: value >= 80 ? 'var(--green)' : value >= 60 ? 'var(--blue)' : 'var(--peach)',
          borderRadius: 999, transition: 'width 0.6s ease',
        }} />
      </div>
      <div className="de-mono" style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{value}</div>
    </div>
  )
}

const SCENARIO_TAGS = [
  { key: 'dev'    as const, label: '职场/IT', icon: '💻' },
  { key: 'daily'  as const, label: '日常',   icon: '☕️' },
  { key: 'travel' as const, label: '旅游',   icon: '✈️' },
]

export default function IntegratedCard({ wide, card, scenarios }: IntegratedCardProps) {
  const isMobile = useIsMobile()
  const activeCard = card || DEFAULT_CARD
  const { word, ipa, partOfSpeech, definition, example, exampleZh, type } = activeCard
  const isWord = type !== 'sentence'
  const [flipped, setFlipped]   = useState(false)
  const [starred, setStarred]   = useState(true)

  const hasScenarios = isWord && scenarios && (scenarios.dev || scenarios.daily || scenarios.travel)
  const [activeScenarioKey, setActiveScenarioKey] = useState<string | null>(null)
  const activeScenario  = activeScenarioKey && scenarios ? scenarios[activeScenarioKey as keyof ScenarioExamples] : null
  const displayExample  = activeScenario?.en || example || ''
  const displayExampleZh = activeScenario?.zh || exampleZh || ''

  const [recState, setRecState] = useState<'idle' | 'recording' | 'analyzing' | 'done'>('idle')
  const [score, setScore]       = useState<{ overall: number; pron: number; flu: number; rhythm: number } | null>(null)
  const [micResult, setMicResult] = useState<string>('')

  const { speak } = useSpeech()
  const assessmentRef = useRef<{ cancel: () => void } | null>(null)

  const applyAzureScore = useCallback((assessment: AssessmentResult) => {
    setMicResult(assessment.recognizedText)
    setScore({
      overall: Math.round(assessment.pronunciationScore),
      pron:    Math.round(assessment.accuracyScore),
      flu:     Math.round(assessment.fluencyScore),
      rhythm:  Math.round(assessment.completenessScore),
    })
    setRecState('done')
  }, [])

  const startRecording = useCallback(() => {
    setRecState('recording')
    setMicResult('')
    setScore(null)

    const referenceText = isWord ? (displayExample || word) : word
    if (!referenceText) {
      alert('没有参考文本，无法进行发音评估')
      setRecState('idle')
      return
    }

    const handle = assessPronunciation(
      referenceText,
      (result) => {
        setRecState('analyzing')
        setTimeout(() => applyAzureScore(result), 400)
      },
      (err) => {
        console.warn('Azure assessment error:', err)
        setRecState('done')
      },
    )
    assessmentRef.current = handle
    handle.start()
  }, [isWord, displayExample, word, applyAzureScore])

  const stopRecording = useCallback(() => {
    assessmentRef.current?.cancel()
    assessmentRef.current = null
    setRecState('analyzing')
    setTimeout(() => setRecState('done'), 600)
  }, [])

  const handleMic = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (recState === 'idle' || recState === 'done') {
      startRecording()
    } else if (recState === 'recording') {
      stopRecording()
    }
  }, [recState, startRecording, stopRecording])

  // ── Sizing tokens ──────────────────────────────────────────────
  const HEIGHT      = isMobile ? (wide ? 320 : 280) : (wide ? 500 : 460)
  const cardPad     = isMobile ? 16 : 28
  const wordFontSz  = isMobile ? (wide ? 28 : 22) : (wide ? 40 : 32)
  const ipaFontSz   = isMobile ? 12 : (wide ? 17 : 15)
  const micBtnSz    = isMobile ? 56 : 72
  const micIconSz   = isMobile ? 22 : 28

  return (
    <div style={{ perspective: 2400, width: '100%' }}>
      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          width: '100%', height: HEIGHT, position: 'relative', cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ═══ FRONT ═══ */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          borderRadius: 'var(--r-xl)', background: 'var(--card)',
          border: '1px solid var(--border)', padding: cardPad,
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-3)', overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: isMobile ? 22 : 28, height: isMobile ? 22 : 28,
                borderRadius: isMobile ? 6 : 8,
                background: 'linear-gradient(135deg, var(--blue), var(--blue-deep))',
                display: 'grid', placeItems: 'center', color: 'white',
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                fontSize: isMobile ? 11 : 13,
                boxShadow: '0 4px 10px rgba(108,132,179,0.3)',
              }}>D</div>
              {!isMobile && (
                <div className="de-pill blue" style={{ fontSize: 11 }}>
                  {activeCard.partOfSpeech || (activeCard.type === 'sentence' ? 'sentence' : 'noun')} · {activeCard.type || (activeCard.example ? 'sentence' : 'word')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={(e) => { e.stopPropagation(); setStarred(s => !s) }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: starred ? 'var(--gold)' : 'var(--ink-mute)', padding: 4 }}>
                <Star size={isMobile ? 16 : 18} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setFlipped(f => !f) }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
                title="Flip to practice">
                <Flip size={isMobile ? 16 : 18} />
              </button>
            </div>
          </div>

          {/* Word */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: isMobile ? '6px 0' : '10px 0' }}>
            <div style={{ fontSize: wordFontSz, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink)', letterSpacing: '-0.02em', textAlign: 'center', lineHeight: 1.2 }}>
              {word}
            </div>

            {/* IPA */}
            {ipa && (
              <div className="de-mono" style={{ color: 'var(--ink-3)', fontSize: ipaFontSz, marginTop: isMobile ? 6 : 10 }}>
                {ipa}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, marginTop: isMobile ? 10 : 16 }}>
              <button onClick={(e) => { e.stopPropagation(); speak(word) }}
                style={{
                  width: isMobile ? 34 : 38, height: isMobile ? 34 : 38,
                  borderRadius: isMobile ? 8 : 10,
                  border: '1px solid var(--blue)', background: 'var(--blue-soft)',
                  color: 'var(--blue-deep)', display: 'grid', placeItems: 'center', cursor: 'pointer',
                }}
                title="Play pronunciation">
                <Volume size={isMobile ? 16 : 18} />
              </button>
              <button onClick={handleMic}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: isMobile ? '7px 12px' : '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${recState === 'recording' ? 'var(--peach)' : 'var(--mint)'}`,
                  background: recState === 'recording' ? 'var(--peach-soft)' : 'var(--mint-soft)',
                  color: recState === 'recording' ? 'var(--peach-deep)' : 'var(--mint-deep)',
                  fontFamily: 'var(--font-sans)', fontSize: isMobile ? 12 : 13, fontWeight: 500, cursor: 'pointer',
                }}
                title="Quick mic test">
                <Mic size={13} />
                {recState === 'recording'
                  ? (isMobile ? 'Stop' : 'Recording...')
                  : (isMobile ? 'Speak' : 'Speak to test')}
              </button>
            </div>

            {/* Definition */}
            <div className="de-zh" style={{ marginTop: isMobile ? 10 : 16, fontSize: isMobile ? 13 : 14, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.5 }}>
              {definition}
            </div>

            {/* Mic result */}
            {micResult && (
              <div style={{ marginTop: 8, padding: '7px 12px', background: 'var(--mint-soft)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--mint-deep)' }}>
                🎤 "{micResult}"
              </div>
            )}
          </div>

          {/* Scenario tags (word mode only) */}
          {hasScenarios && (
            <div style={{ display: 'flex', gap: isMobile ? 5 : 8, marginBottom: isMobile ? 6 : 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {SCENARIO_TAGS.map(({ key, label, icon }) => {
                const enabled = scenarios![key]
                const isActive = (activeScenarioKey || 'daily') === key
                return (
                  <button
                    key={key}
                    onClick={(e) => { e.stopPropagation(); setActiveScenarioKey(key) }}
                    disabled={!enabled}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: isMobile ? '3px 10px' : '4px 12px',
                      borderRadius: 999, border: 'none',
                      cursor: enabled ? 'pointer' : 'not-allowed',
                      fontSize: isMobile ? 11 : 11.5, fontWeight: 500,
                      fontFamily: 'var(--font-sans)',
                      background: isActive ? 'var(--blue)' : 'var(--surface-2)',
                      color: isActive ? 'white' : 'var(--ink-2)',
                      opacity: enabled ? 1 : 0.4,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {icon} {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Example sentence */}
          {displayExample && (
            <div style={{
              padding: isMobile ? '10px 12px' : '12px 16px',
              background: 'var(--surface-2)', borderRadius: 'var(--r-md)',
              fontFamily: 'var(--font-mono)', fontSize: isMobile ? 12 : 13,
              color: 'var(--ink-2)', lineHeight: 1.5,
            }}>
              <div>{displayExample}</div>
              {displayExampleZh && (
                <div className="de-zh" style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-3)' }}>
                  {displayExampleZh}
                </div>
              )}
            </div>
          )}

          {/* Tap hint */}
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
            {isMobile ? 'tap to flip' : 'tap card to flip · practice pronunciation'}
          </div>
        </div>

        {/* ═══ BACK (Practice side) ═══ */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
          borderRadius: 'var(--r-xl)', background: 'var(--card)',
          border: '1px solid var(--border)', padding: cardPad,
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-3)', overflow: 'hidden',
        }}>
          <div className="de-eyebrow" style={{ marginBottom: 4 }}>Oral Practice · 口语跟读</div>
          {!isMobile && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>
              Read the sentence aloud. AI scores your pronunciation.
            </div>
          )}

          {/* Sentence to read */}
          <div style={{
            padding: isMobile ? '12px 14px' : '16px 18px',
            background: 'var(--blue-tint)', borderRadius: 'var(--r-md)',
            border: '1px solid var(--blue-soft)',
            fontSize: isMobile ? 15 : 18, lineHeight: 1.5,
            fontFamily: 'var(--font-mono)', color: 'var(--ink)',
            marginBottom: isMobile ? 0 : undefined,
          }}>
            {isWord ? (displayExample || word) : word}
          </div>

          {/* Recording controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: isMobile ? 12 : 16 }}>
            <button onClick={handleMic}
              style={{
                width: micBtnSz, height: micBtnSz, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: recState === 'recording'
                  ? 'linear-gradient(135deg, var(--peach), var(--peach-deep))'
                  : 'linear-gradient(135deg, var(--blue), var(--blue-deep))',
                color: 'white', display: 'grid', placeItems: 'center',
                boxShadow: recState === 'recording'
                  ? '0 0 0 8px rgba(212,160,121,0.2), 0 12px 30px rgba(212,160,121,0.4)'
                  : '0 12px 30px rgba(108,132,179,0.4)',
              }}>
              <Mic size={micIconSz} color="white" />
            </button>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: isMobile ? 11 : 12, fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            {recState === 'idle' && 'tap mic to record'}
            {recState === 'recording' && 'tap to stop'}
            {recState === 'analyzing' && 'analyzing…'}
            {recState === 'done' && 'tap to try again'}
          </div>

          {/* Score display */}
          {score && (
            <div style={{ marginTop: isMobile ? 8 : 12, padding: isMobile ? '10px 12px' : '14px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
              <div className="de-eyebrow" style={{ marginBottom: isMobile ? 6 : 8 }}>AI Feedback</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: isMobile ? 8 : 12 }}>
                <span style={{ fontSize: isMobile ? 28 : 36, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  color: score.overall >= 80 ? 'var(--green-deep)' : score.overall >= 60 ? 'var(--blue-deep)' : 'var(--peach-deep)'
                }}>{score.overall}</span>
                <span style={{ fontSize: isMobile ? 13 : 16, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>/ 100</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 6 : 8 }}>
                <Metric label={isMobile ? 'Pron.' : 'Pronunciation'} value={score.pron} />
                <Metric label="Fluency"                               value={score.flu} />
                <Metric label={isMobile ? 'Complete.' : 'Rhythm'}    value={score.rhythm} />
              </div>
            </div>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, marginTop: isMobile ? 10 : 14 }}>
            <button className="de-btn ghost" onClick={(e) => { e.stopPropagation(); speak(isWord ? (displayExample || word) : word) }}
              style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--border)', fontSize: isMobile ? 12 : 13, height: isMobile ? 36 : 40 }}>
              <Volume size={14} /> {isMobile ? 'Listen' : (isWord ? 'Sentence' : 'Listen again')}
            </button>
            <button className="de-btn ghost" onClick={(e) => { e.stopPropagation(); setRecState('idle'); setScore(null); setMicResult('') }}
              style={{ flex: 1, justifyContent: 'center', fontSize: isMobile ? 12 : 13, height: isMobile ? 36 : 40 }}>
              <Refresh size={14} /> {isMobile ? 'Retry' : 'Try again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
