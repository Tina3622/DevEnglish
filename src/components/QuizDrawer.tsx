import { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from '../engine/db'
import type { IFlashcard } from '../engine/db'

/** 后备迷惑选项（词库不足 4 个时使用） */
const FALLBACK_DISTRACTORS = [
  '成功', '发展', '技术', '市场', '机会',
  '挑战', '结果', '过程', '支持', '系统',
  '设计', '项目', '团队', '产品', '服务',
  '经验', '管理', '操作', '功能', '价值',
]

// FIX: module-level pure function — no need for useCallback, no `this` issues
const FALLBACK_EN_MAP: Record<string, string> = {
  '成功': 'Success',  '发展': 'Development', '技术': 'Technology',
  '市场': 'Market',   '机会': 'Opportunity',  '挑战': 'Challenge',
  '结果': 'Result',   '过程': 'Process',      '支持': 'Support',
  '系统': 'System',   '设计': 'Design',       '项目': 'Project',
  '团队': 'Team',     '产品': 'Product',      '服务': 'Service',
  '经验': 'Experience','管理': 'Management',  '操作': 'Operation',
  '功能': 'Feature',  '价值': 'Value',
}
function translateFallback(zh: string): string {
  return FALLBACK_EN_MAP[zh] ?? zh
}

interface Question {
  /** 英文单词/短语 */
  word: string
  /** 正确中文释义 */
  correctDef: string
  /** 四个选项（已打乱） */
  options: string[]
  /** 正确选项的索引 */
  correctIndex: number
}

interface QuizDrawerProps {
  onClose: () => void
}

/**
 * 课后习题抽屜
 * - 从 Dexie 个人词库随机出 5 题
 * - 看英文选中文，四选一
 * - 答完显示分数 + 逐题回顾（正误）
 */
export default function QuizDrawer({ onClose }: QuizDrawerProps) {
  const [phase, setPhase] = useState<'loading' | 'playing' | 'done'>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  // FIX: track per-question correctness so the review section works
  const [correctAnswers, setCorrectAnswers] = useState<Set<number>>(new Set())
  const [showCelebration, setShowCelebration] = useState(false)

  const generateQuiz = useCallback((cards: IFlashcard[]) => {
    // 可用的词条（含 fallback）
    const wordPool = cards.length >= 4
      ? cards.map(c => ({ word: c.word, def: c.definition || c.word }))
      : [
          ...cards.map(c => ({ word: c.word, def: c.definition || c.word })),
          // 凑一些伪条目用于 distractor
          ...FALLBACK_DISTRACTORS.slice(0, 20 - cards.length).map((d, i) => ({
            word: `__fallback_${i}`,
            def: d,
          })),
        ]

    const totalQuestions = Math.min(5, cards.length || 5)
    const shuffled = [...wordPool].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, totalQuestions)

    const qs: Question[] = selected.map((item) => {
      // 从剩余词条中随机抽 3 个不同 def 作为 distractors
      const others = wordPool.filter(w => w.def !== item.def)
      const distractors: string[] = []
      const shuffledOthers = [...others].sort(() => Math.random() - 0.5)
      for (const o of shuffledOthers) {
        if (distractors.length >= 3) break
        if (!distractors.includes(o.def) && o.def !== item.def) {
          distractors.push(o.def)
        }
      }
      // 不够 3 个时补充 fallback
      while (distractors.length < 3) {
        const fb = FALLBACK_DISTRACTORS[Math.floor(Math.random() * FALLBACK_DISTRACTORS.length)]
        if (!distractors.includes(fb) && fb !== item.def) {
          distractors.push(fb)
        }
      }

      const options = [item.def, ...distractors].sort(() => Math.random() - 0.5)
      const correctIndex = options.indexOf(item.def)

      return {
        // FIX: was `this.translateFallback(...)` — `this` is undefined in function components
        word: item.word.startsWith('__fallback_') ? translateFallback(item.def) : item.word,
        correctDef: item.def,
        options,
        correctIndex,
      }
    })

    setQuestions(qs)
    setPhase('playing')
  }, [])

  // 加载词库 + 生成题目
  useEffect(() => {
    ;(async () => {
      const cards = await db.flashcards.orderBy('createdAt').reverse().toArray()
      generateQuiz(cards)
    })()
  }, [generateQuiz])

  const currentQ = questions[currentIdx]
  const isLast = currentIdx >= questions.length - 1

  const handleSelect = useCallback((idx: number) => {
    if (selectedIdx !== null) return // 已选过
    setSelectedIdx(idx)
    const correct = idx === currentQ?.correctIndex
    setIsCorrect(correct)
    if (correct) {
      setScore(prev => prev + 1)
      // FIX: record which question index was correct
      setCorrectAnswers(prev => new Set([...prev, currentIdx]))
    }

    // 延迟跳下一题
    setTimeout(() => {
      if (isLast) {
        setPhase('done')
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 2000)
      } else {
        setCurrentIdx(prev => prev + 1)
        setSelectedIdx(null)
        setIsCorrect(null)
      }
    }, correct ? 800 : 1500)
  }, [selectedIdx, currentQ, isLast, currentIdx])

  const handleRestart = useCallback(() => {
    setPhase('loading')
    setCurrentIdx(0)
    setSelectedIdx(null)
    setIsCorrect(null)
    setScore(0)
    setCorrectAnswers(new Set())
    setShowCelebration(false)
    // 重新出题
    ;(async () => {
      const cards = await db.flashcards.orderBy('createdAt').reverse().toArray()
      generateQuiz(cards)
    })()
  }, [generateQuiz])

  // ── 通关庆祝动画 ──
  const celebrationParticles = useMemo(() => {
    if (!showCelebration) return []
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4']
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 10,
    }))
  }, [showCelebration])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>
      {/* 庆祝粒子 */}
      {showCelebration && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999, overflow: 'hidden' }}>
          {celebrationParticles.map(p => (
            <div
              key={p.id}
              style={{
                position: 'absolute', bottom: 0,
                left: `${p.left}%`,
                width: p.size, height: p.size,
                borderRadius: '50%',
                background: p.color,
                animation: `quizCelebrate 1.5s ${p.delay}s ease-out forwards`,
              }}
            />
          ))}
          <style>{`
            @keyframes quizCelebrate {
              0% { transform: translateY(0) scale(1); opacity: 1; }
              100% { transform: translateY(-400px) scale(0.5); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {phase === 'loading' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, color: 'var(--ink-3)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--blue)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 14 }}>正在生成题目...</div>
        </div>
      )}

      {phase === 'playing' && currentQ && (
        <>
          {/* 进度 */}
          <div style={{
            display: 'flex', gap: 6, justifyContent: 'center',
          }}>
            {questions.map((_, i) => (
              <div key={i} style={{
                width: 32, height: 4, borderRadius: 2,
                background: i < currentIdx ? 'var(--green)' : i === currentIdx ? 'var(--blue)' : 'var(--surface-2)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          {/* 分数 */}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
            {score} / {currentIdx + (selectedIdx !== null ? 1 : 0)} 正确
          </div>

          {/* 题目 */}
          <div style={{
            padding: '24px 20px',
            background: 'var(--blue-tint)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--blue-soft)',
            textAlign: 'center',
          }}>
            <div className="de-eyebrow" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
              第 {currentIdx + 1} / {questions.length} 题 · 选择正确的中文释义
            </div>
            <div style={{
              fontSize: 26, fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}>
              {currentQ.word}
            </div>
          </div>

          {/* 选项 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentQ.options.map((opt, idx) => {
              let bg = 'var(--surface-2)'
              let border = 'var(--border)'
              let color = 'var(--ink-2)'

              if (selectedIdx !== null) {
                if (idx === currentQ.correctIndex) {
                  bg = 'var(--green-soft)'
                  border = 'var(--green)'
                  color = 'var(--green-deep)'
                } else if (idx === selectedIdx && !isCorrect) {
                  bg = 'var(--peach-soft)'
                  border = 'var(--peach)'
                  color = 'var(--peach-deep)'
                } else {
                  bg = 'var(--surface-2)'
                  border = 'var(--border)'
                  color = 'var(--ink-3)'
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={selectedIdx !== null}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderRadius: 'var(--r-md)',
                    border: `1.5px solid ${border}`,
                    background: bg,
                    cursor: selectedIdx !== null ? 'default' : 'pointer',
                    textAlign: 'left',
                    fontSize: 14,
                    fontFamily: 'var(--font-sans)',
                    color: color,
                    transition: 'all 0.2s',
                    width: '100%',
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: `1.5px solid ${selectedIdx !== null && idx === currentQ.correctIndex ? 'var(--green)' : 'var(--border)'}`,
                    display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 600,
                    flexShrink: 0,
                    background: selectedIdx !== null && idx === currentQ.correctIndex ? 'var(--green)' : 'transparent',
                    color: selectedIdx !== null && idx === currentQ.correctIndex ? 'white' : 'inherit',
                  }}>
                    {selectedIdx !== null && idx === currentQ.correctIndex ? '✓' : String.fromCharCode(65 + idx)}
                  </div>
                  <span className="de-zh">{opt}</span>
                </button>
              )
            })}
          </div>

          {/* 答案反馈 */}
          {selectedIdx !== null && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--r-md)',
              background: isCorrect ? 'var(--mint-soft)' : 'var(--peach-soft)',
              border: `1px solid ${isCorrect ? 'var(--mint)' : 'var(--peach)'}`,
              color: isCorrect ? 'var(--mint-deep)' : 'var(--peach-deep)',
              fontSize: 13, textAlign: 'center',
            }}>
              {isCorrect ? '✅ 正确！' : `❌ 正确答案是：${currentQ.correctDef}`}
            </div>
          )}
        </>
      )}

      {phase === 'done' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, textAlign: 'center',
        }}>
          {/* 庆祝星星 */}
          <div style={{ fontSize: 48, lineHeight: 1 }}>
            {score >= 4 ? '🏆' : score >= 3 ? '🎉' : '💪'}
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)' }}>
            Quiz Completed!
          </div>
          <div style={{
            fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: score >= 4 ? 'var(--green-deep)' : score >= 3 ? 'var(--blue-deep)' : 'var(--peach-deep)',
          }}>
            {score} / {questions.length}
          </div>
          <div className="de-zh" style={{ fontSize: 14, color: 'var(--ink-3)' }}>
            {score >= 4 ? '太棒了！学得很好 👏' : score >= 3 ? '不错，继续加油！' : '再接再厉！'}
          </div>

          {/* 逐题回顾 — FIX: correctAnswers 集合正确标记每题结果 */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div className="de-eyebrow" style={{ marginBottom: 4 }}>答题回顾</div>
            {questions.map((q, i) => {
              const isQCorrect = correctAnswers.has(i)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 'var(--r-sm)',
                  background: isQCorrect ? 'var(--green-soft)' : 'var(--peach-soft)',
                  border: `1px solid ${isQCorrect ? 'var(--green)' : 'var(--peach)'}`,
                  fontSize: 13,
                }}>
                  <span>{isQCorrect ? '✅' : '❌'}</span>
                  <span className="de-mono" style={{ fontWeight: 600, flex: 1 }}>{q.word}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 12 }} className="de-zh">{q.correctDef}</span>
                </div>
              )
            })}
          </div>

          {/* 按钮组 */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, width: '100%' }}>
            <button
              onClick={handleRestart}
              style={{
                flex: 1, padding: '10px 20px', borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'var(--card)', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, color: 'var(--ink-2)',
              }}
            >
              再来一次
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 20px', borderRadius: 999,
                border: 'none',
                background: 'linear-gradient(135deg, var(--blue), var(--blue-deep))',
                color: 'white', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
              }}
            >
              完成关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
