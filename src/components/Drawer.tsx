import React from 'react'
import { X } from './Icons'
import { useIsMobile } from '../lib/useIsMobile'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** 抽屉宽度，桌面端默认 440px */
  width?: number
}

/**
 * 右侧滑动抽屉
 * 点击遮罩或关闭按钮收起
 */
export default function Drawer({ open, onClose, title, children, width: desktopWidth = 440 }: DrawerProps) {
  const isMobile = useIsMobile()
  const drawerWidth = isMobile ? '95vw' : desktopWidth

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: drawerWidth,
          background: 'var(--card)',
          zIndex: 201,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
          boxShadow: open ? '-4px 0 30px rgba(0,0,0,0.12)' : 'none',
          display: 'flex', flexDirection: 'column',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: 'none', background: 'var(--surface-2)',
              cursor: 'pointer', display: 'grid', placeItems: 'center',
              color: 'var(--ink-3)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px' }}>
          {children}
        </div>
      </div>
    </>
  )
}
