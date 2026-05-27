import React, { useState } from 'react'
import { Chevron, User as UserIcon, Book, Settings as SettingsIcon, X } from './Icons'
import { useIsMobile } from '../lib/useIsMobile'

interface TopBarProps {
  dict?: string
  dictZh?: string
  onDictChange?: () => void
  user?: { name: string } | null
  onAvatarClick?: () => void
  onSignIn?: (mode: 'signin' | 'register') => void
  onLogOut?: () => void
}

export default function TopBar({
  dict = 'My Vocabulary',
  dictZh = '个人场景词库',
  onDictChange,
  user,
  onAvatarClick,
  onSignIn,
  onLogOut,
}: TopBarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const isMobile = useIsMobile()

  const initials =
    user && user.name
      ? user.name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'TY'

  const dropdownItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', fontSize: 12.5,
    border: 'none', background: 'transparent',
    width: '100%', textAlign: 'left',
    borderRadius: 'var(--r-sm)',
    cursor: 'pointer', color: 'var(--ink-2)',
  }

  return (
    <div
      className="de-topbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 20,
        padding: isMobile ? '10px 16px' : '14px 28px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          className="de-logo"
          style={{
            width: isMobile ? 26 : 30,
            height: isMobile ? 26 : 30,
            borderRadius: isMobile ? 7 : 9,
            background: 'linear-gradient(135deg, var(--blue), var(--blue-deep))',
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            fontSize: isMobile ? 12 : 14,
            boxShadow: '0 4px 10px rgba(108,132,179,0.3)',
            flexShrink: 0,
          }}
        >
          D
        </div>
        {/* Brand name + pill: hidden on mobile to save space */}
        {!isMobile && (
          <>
            <div className="de-brand-name" style={{ fontSize: 16, fontWeight: 600 }}>
              DevEnglish
            </div>
            <div
              className="de-pill de-mono"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--surface-2)',
                color: 'var(--ink-3)',
                border: '1px solid var(--border)',
              }}
            >
              v2.1 · integrated
            </div>
          </>
        )}
        {/* Mobile: just show "DevEnglish" text without pill */}
        {isMobile && (
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            DevEnglish
          </div>
        )}
      </div>

      {/* Dictionary picker — hidden on mobile (dict is selected in TypingPage itself) */}
      {!isMobile && (
        <div
          className="de-dict-picker"
          onClick={onDictChange}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 14px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          <div>
            <div
              className="label"
              style={{
                fontSize: 10,
                color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Current Dictionary
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 1 }}>
              <span className="val" style={{ fontSize: 13, fontWeight: 600 }}>
                {dict}
              </span>
              <span className="zh" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {dictZh}
              </span>
            </div>
          </div>
          <Chevron size={16} color="var(--ink-3)" />
        </div>
      )}

      {/* Avatar + dropdown — always visible */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'relative',
        marginLeft: isMobile ? 'auto' : undefined,
      }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            title="Personal Center"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 0 : 8,
              padding: isMobile ? '3px' : '4px 10px 4px 4px',
              border: `1px solid ${showDropdown ? 'var(--mint)' : 'var(--border)'}`,
              background: showDropdown ? 'var(--mint-soft)' : 'var(--card)',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          >
            <div
              className="de-avatar"
              style={{
                width: isMobile ? 30 : 28,
                height: isMobile ? 30 : 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--blue), var(--blue-deep))',
                display: 'grid',
                placeItems: 'center',
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              TY
            </div>
            {!isMobile && (
              <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>
                Tina ▾
              </span>
            )}
          </button>

          {showDropdown && (
            <div
              className="de-card"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                width: 160,
                padding: 6,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxShadow: 'var(--shadow-3)',
                border: '1px solid var(--border)',
                background: 'white',
              }}
            >
              <button
                onClick={() => { setShowDropdown(false); onAvatarClick?.() }}
                style={dropdownItemStyle}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <UserIcon size={14} />
                个人中心 <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-mute)' }}>My Data</span>
              </button>
              <button
                onClick={() => { setShowDropdown(false) }}
                style={dropdownItemStyle}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Book size={14} />
                词库管理 <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-mute)' }}>Vocab</span>
              </button>
              <button
                onClick={() => { setShowDropdown(false) }}
                style={dropdownItemStyle}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <SettingsIcon size={14} />
                偏好设置 <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-mute)' }}>Settings</span>
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 4px' }} />
              <button
                onClick={() => { setShowDropdown(false); onLogOut?.() }}
                style={{ ...dropdownItemStyle, color: 'var(--peach-deep)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--peach-soft)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X size={14} />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
