import React, { useState } from 'react'
import { Search, Plus, Keyboard, Camera, Mic, Sparkles, ArrowRight } from './Icons'
import { useIsMobile } from '../lib/useIsMobile'

interface QuickInputDockProps {
  value?: string
  onChange?: (v: string) => void
  onAdd?: () => void
  loading?: boolean
}

const MODE_OPTIONS = [
  { key: 'text',  icon: <Keyboard size={16} />, label: 'Manual',    zh: '手动', emoji: '⌨️' },
  { key: 'ocr',  icon: <Camera  size={16} />, label: 'OCR Photo', zh: '拍照',  emoji: '📷' },
  { key: 'voice', icon: <Mic     size={16} />, label: 'Voice',     zh: '语音',  emoji: '🎙️' },
]

export default function QuickInputDock({ value = '', onChange, onAdd, loading = false }: QuickInputDockProps) {
  const [mode, setMode] = useState('text')
  const isMobile = useIsMobile()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && value.trim()) {
      onAdd?.()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Input row */}
      <div
        className="de-card"
        style={{
          padding: isMobile ? 12 : 16,
          background: 'linear-gradient(180deg, #fff 0%, #fbfaf6 100%)',
        }}
      >
        {/* Input + button: stacked on mobile, side-by-side on desktop */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 8 : 12,
        }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-md)',
              padding: isMobile ? '10px 14px' : '10px 16px',
              border: '1px solid var(--border)',
            }}
          >
            <Search size={18} color="var(--ink-3)" style={{ flexShrink: 0 }} />
            <input
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={isMobile ? '输入单词/中文句子…' : 'Type English or 中文 to translate & save as flashcard…'}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: isMobile ? 16 : 15, // 16px on mobile prevents iOS auto-zoom
                color: 'var(--ink)',
                fontFamily: 'var(--font-sans)',
              }}
            />
            {/* Keyboard shortcut: desktop only */}
            {!isMobile && (
              <div
                className="de-pill de-mono"
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  background: 'var(--card)', color: 'var(--ink-3)',
                  border: '1px solid var(--border)', flexShrink: 0,
                }}
              >
                ⌘ K
              </div>
            )}
          </div>

          <button
            className="de-btn primary"
            onClick={onAdd}
            disabled={loading || !value.trim()}
            style={{
              minWidth: isMobile ? 'auto' : 130,
              width: isMobile ? '100%' : undefined,
              cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
              height: isMobile ? 44 : 40,
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <span
                  style={{
                    width: 13, height: 13,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                {isMobile ? 'Translating…' : 'AI Translating...'}
              </span>
            ) : (
              <>
                <Plus size={16} />
                {isMobile ? 'Add Card' : 'Add to Cards'}
              </>
            )}
          </button>
        </div>

        {/* Mode pills */}
        <div
          style={{
            display: 'flex',
            gap: isMobile ? 6 : 8,
            marginTop: isMobile ? 10 : 12,
            paddingTop: isMobile ? 10 : 12,
            borderTop: '1px dashed var(--border)',
            overflowX: isMobile ? 'auto' : 'visible',
            // allow scroll on very narrow screens without clipping shadow
            paddingBottom: isMobile ? 2 : 0,
          }}
        >
          {MODE_OPTIONS.map((item) => (
            <button
              key={item.key}
              onClick={() => setMode(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 5 : 8,
                padding: isMobile ? '7px 12px' : '8px 14px',
                border: `1px solid ${mode === item.key ? 'var(--mint)' : 'var(--border)'}`,
                background: mode === item.key ? 'var(--mint-soft)' : 'var(--card)',
                color: mode === item.key ? 'var(--mint-deep)' : 'var(--ink-2)',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: isMobile ? 12 : 13,
                flexShrink: 0, // prevent pill from shrinking on narrow screens
                whiteSpace: 'nowrap',
              }}
            >
              {isMobile ? item.emoji : item.icon}
              <span style={{ fontWeight: 500 }}>{item.label}</span>
              {/* zh sub-label: only on desktop */}
              {!isMobile && (
                <span style={{ color: mode === item.key ? 'var(--mint-deep)' : 'var(--ink-3)', opacity: 0.8, fontSize: 12 }}>
                  {item.zh}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* AI hint banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: isMobile ? '8px 12px' : '10px 14px',
          background: 'var(--mint-soft)',
          border: '1px dashed var(--mint)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--ink-2)',
          fontSize: isMobile ? 12 : 13,
          position: 'relative',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        {/* Tooltip arrow: desktop only */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute', top: -5, left: 30,
              width: 10, height: 10,
              background: 'var(--mint-soft)',
              borderLeft: '1px dashed var(--mint)',
              borderTop: '1px dashed var(--mint)',
              transform: 'rotate(45deg)',
            }}
          />
        )}
        <Sparkles size={14} color="var(--mint-deep)" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>
          <span style={{ color: 'var(--mint-deep)', fontWeight: 600 }}>
            {isMobile ? '支持中文句子' : '「支持输入中文句子'}
          </span>
          <ArrowRight size={12} color="var(--mint-deep)" style={{ verticalAlign: -1, margin: '0 4px' } as React.CSSProperties} />
          <span style={{ color: 'var(--mint-deep)', fontWeight: 600 }}>
            {isMobile ? 'AI 自动翻译' : 'AI 自动翻译日常地道口语并推送到单词卡」'}
          </span>
        </span>
        {/* Example: desktop only */}
        {!isMobile && (
          <span style={{ color: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            e.g. "我的代码合并失败了" → "My code merge failed."
          </span>
        )}
      </div>
    </div>
  )
}
