import { Outlet, Link, useLocation } from 'react-router-dom'
import TitleBar from './TitleBar'
import TopBar from './TopBar'
import { useIsMobile } from '../lib/useIsMobile'

const TABS = [
  { path: '/', label: 'Dashboard', emoji: '🏠' },
  { path: '/typing', label: 'Typing', emoji: '⌨️' },
]

export default function Layout() {
  const location = useLocation()
  const isMobile = useIsMobile()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
      {/* TitleBar only shown on desktop (macOS window chrome feel) */}
      {!isMobile && <TitleBar label="DevEnglish · Integrated Experience v2.1" />}
      <TopBar />

      {/* Tab navigation */}
      <div style={{
        display: 'flex', gap: 0,
        padding: isMobile ? '0 16px' : '0 28px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        {TABS.map(tab => {
          const active = location.pathname === tab.path
          return (
            <Link key={tab.path} to={tab.path} style={{
              padding: isMobile ? '10px 16px' : '10px 20px',
              textDecoration: 'none',
              fontSize: isMobile ? 12 : 13,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--blue-deep)' : 'var(--ink-3)',
              borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
              transition: 'all 0.12s',
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {isMobile && <span>{tab.emoji}</span>}
              {tab.label}
            </Link>
          )
        })}
      </div>

      <main className="de-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--surface)' }}>
        <Outlet />
      </main>
    </div>
  )
}
