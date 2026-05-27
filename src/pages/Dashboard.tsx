import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../lib/useIsMobile'
import QuickInputDock from '../components/QuickInputDock'
import IntegratedCard from '../components/IntegratedCard'
import StreakWidget from '../components/StreakWidget'
import { Book, Headphones, Lightning, ArrowRight, X } from '../components/Icons'
import Drawer from '../components/Drawer'
import SpeakDrawer from '../components/SpeakDrawer'
import QuizDrawer from '../components/QuizDrawer'
import { translateText } from '../lib/translate'
import { useCards } from '../lib/useCards'
import { listenCheckin } from '../lib/typingProtocol'

function MiniEntry({
  icon, title, sub, color, onClick,
}: {
  icon: React.ReactNode; title: string; sub: string; color: 'blue' | 'mint' | 'peach'
  onClick?: () => void
}) {
  const bg = color === 'blue' ? 'var(--blue-soft)' : color === 'mint' ? 'var(--mint-soft)' : 'var(--peach-soft)'
  const fg = color === 'blue' ? 'var(--blue-deep)' : color === 'mint' ? 'var(--mint-deep)' : 'var(--peach-deep)'
  return (
    <div className="de-card de-hover-lift" onClick={onClick} style={{
      padding: 14, display: 'flex', alignItems: 'center', gap: 12,
      cursor: onClick ? 'pointer' : 'default', borderRadius: 'var(--r-lg)', background: 'var(--card)',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'grid', placeItems: 'center', color: fg, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
        <div className="de-zh" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
      <ArrowRight size={14} color="var(--ink-3)" />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [currentScenarios, setCurrentScenarios] = useState<import('../lib/translate').ScenarioExamples | null>(null)
  const { cards, loading, setLoading, toast, clearToast, addCard, deleteCard } = useCards()
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // FIX: clear timer on unmount to avoid setState on unmounted component
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // 打字通关打卡监听：刷新日历
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    return listenCheckin(() => forceUpdate(n => n + 1))
  }, [])

  // 口语跟读抽屜
  const [speakOpen, setSpeakOpen] = useState(false)
  // 课后习题抽屜
  const [quizOpen, setQuizOpen] = useState(false)
  const speakSentence = cards[0]?.example || cards[0]?.word || ''
  const speakTranslation = cards[0]?.definition || ''

  const handleAdd = useCallback(async () => {
    if (!input.trim() || loading) return
    setError(null)
    setLoading(true)
    try {
      const result = await translateText(input.trim())
      setCurrentScenarios(result.scenarios || null)
      await addCard(result)
      setInput('')
    } catch (err: any) {
      setError(err.message || '翻译失败，请检查 DeepSeek Key 是否配置正确，或网络是否通畅')
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setError(null), 5000)
    } finally {
      setLoading(false)
    }
  }, [input, loading, setLoading, addCard])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18,
      maxWidth: 1200, margin: '0 auto',
      padding: isMobile ? '14px 14px 80px' : 'var(--page-pad) var(--page-pad) 60px',
    }}>
      <QuickInputDock value={input} onChange={setInput} onAdd={handleAdd} loading={loading} />

      {/* Toast / Error */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: toast.type === 'add' ? 'var(--mint-soft)' : 'var(--peach-soft)',
          border: `1px solid ${toast.type === 'add' ? 'var(--mint)' : 'var(--peach)'}`,
          borderRadius: 'var(--r-md)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 14, color: toast.type === 'add' ? 'var(--mint-deep)' : 'var(--peach-deep)',
          boxShadow: 'var(--shadow-3)',
        }}>
          <span>{toast.type === 'add' ? '✅' : '🗑️'} <strong>{toast.word}</strong>
            {toast.type === 'add' ? ' added' : ' deleted'}</span>
          <button onClick={clearToast} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--r-md)',
          background: 'var(--peach-soft)', border: '1px solid var(--peach)',
          color: 'var(--peach-deep)', fontSize: 13, lineHeight: 1.5,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Card display */}
      {cards.length > 0 ? (
        <IntegratedCard wide card={cards[0]} scenarios={currentScenarios || undefined} />
      ) : (
        <div className="de-card" style={{
          padding: 40, textAlign: 'center', minHeight: 180,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          border: '2px dashed var(--border)',
        }}>
          <div style={{ fontSize: 32 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>你的词卡还是空的</div>
          <div className="de-zh" style={{ color: 'var(--ink-3)', maxWidth: 400 }}>
            在上方输入英文或中文单词/句子，点击 <strong>Add to Cards</strong>，AI 会自动翻译并生成词卡
          </div>
        </div>
      )}

      {/* Bottom row — stacks vertically on mobile */}
      <div className="de-row" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 18, marginTop: 8 }}>
        <div style={{ flex: isMobile ? 'none' : 1.3 }}>
          <StreakWidget />
        </div>
        <div style={{ flex: isMobile ? 'none' : 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="de-section-label" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h3 className="de-h3" style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>Quick Entry</h3>
            {!isMobile && <span className="sub" style={{ fontSize: 12, color: 'var(--ink-3)' }}>deep-dive views</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MiniEntry icon={<Book size={18} />} title="Start Review" sub={`开始今日复习 · ${cards.length} cards`} color="blue" onClick={() => navigate('/typing?start=personal')} />
            <MiniEntry icon={<Headphones size={18} />} title="Speak & Pronounce" sub={cards.length > 0 ? '点击开始跟读' : '先添加词卡'} color="mint" onClick={cards.length > 0 ? () => setSpeakOpen(true) : undefined} />
            <MiniEntry icon={<Lightning size={18} />} title="Quick Quiz" sub={cards.length > 0 ? '5 道选择题 · 点击开始' : '先添加词卡'} color="peach" onClick={cards.length > 0 ? () => setQuizOpen(true) : undefined} />
          </div>
        </div>
      </div>

      {/* My Cards */}
      {cards.length > 0 && (
        <div className="de-card" style={{ marginTop: 8, padding: isMobile ? '14px 12px' : '20px 20px' }}>
          <div className="de-section-label" style={{ marginBottom: isMobile ? 10 : 14 }}>
            <h3 className="de-h3" style={{ fontSize: isMobile ? 14 : 16 }}>My Cards · 我的词卡</h3>
            <span className="sub de-mono" style={{ fontSize: isMobile ? 11 : 12 }}>{cards.length} words</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cards.map((card, i) => (
              <div key={card.id || i} style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14,
                padding: isMobile ? '10px 12px' : '12px 16px', borderRadius: 'var(--r-md)',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {card.word}
                    </span>
                    {card.ipa && !isMobile && (
                      <span className="de-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {card.ipa}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: isMobile ? 12 : 13, color: 'var(--ink-2)', marginTop: 2 }} className="de-zh">
                    {card.definition}
                  </div>
                </div>
                <button onClick={() => deleteCard(card.id, card.word)}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: 'var(--ink-mute)', padding: 6, borderRadius: 6,
                    display: 'grid', placeItems: 'center',
                  }}
                  title="Delete">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 口语跟读抽屜 */}
      <Drawer open={speakOpen} onClose={() => setSpeakOpen(false)} title="Speak & Pronounce · 口语跟读">
        {speakSentence ? (
          <SpeakDrawer sentence={speakSentence} translation={speakTranslation} />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>
            暂无跟读文本，请先添加词卡
          </div>
        )}
      </Drawer>

      {/* 课后习题抽屜 */}
      <Drawer open={quizOpen} onClose={() => setQuizOpen(false)} title="Quick Quiz · 课后习题">
        <QuizDrawer onClose={() => setQuizOpen(false)} />
      </Drawer>
    </div>
  )
}
