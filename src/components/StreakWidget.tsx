import React, { useState, useEffect } from 'react'
import { Flame, Check, Trophy } from './Icons'
import { isTodayCheckedIn, getCheckinDates, listenCheckin } from '../lib/typingProtocol'
import { useIsMobile } from '../lib/useIsMobile'

/** 获取本周的日期（周一起） */
function getWeekDates(): { dayLabel: string; date: Date; dateNum: number }[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
  const monOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + monOffset)
  monday.setHours(0, 0, 0, 0)

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return days.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { dayLabel: label, date: d, dateNum: d.getDate() }
  })
}

/** 计算连续打卡天数（从今天往前数） */
function calcStreak(checkinSet: Set<string>): number {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    if (checkinSet.has(key)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export default function StreakWidget() {
  const isMobile = useIsMobile()
  const [checkedIn, setCheckedIn] = useState(isTodayCheckedIn)

  useEffect(() => {
    return listenCheckin(() => setCheckedIn(true))
  }, [])

  const weekDates = getWeekDates()
  const todayStr = new Date().toDateString()
  const checkinSet = getCheckinDates()
  const effectiveDates = new Set(checkinSet)
  if (checkedIn) {
    const d = new Date()
    effectiveDates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
  }

  const streak = calcStreak(effectiveDates)

  const getState = (date: Date): 'done' | 'today' | 'empty' => {
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    const isToday = date.toDateString() === todayStr
    if (isToday) return checkedIn ? 'done' : 'today'
    if (effectiveDates.has(key)) return 'done'
    return 'empty'
  }

  const cellSize = isMobile ? 38 : 56

  return (
    <div
      className="de-card de-card-pad"
      style={{
        padding: isMobile ? 16 : 22,
        background: 'linear-gradient(135deg, #fffaf0 0%, #fff 60%)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 className="de-h3" style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>
            Daily Check-in
          </h3>
          <div className="de-zh" style={{ marginTop: 2, fontSize: 12, color: 'var(--ink-3)' }}>
            学习打卡 · 连续坚持获得勋章
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--peach-deep)', fontWeight: 600 }}>
          <Flame size={isMobile ? 18 : 20} color="var(--peach-deep)" />
          <span style={{ fontSize: isMobile ? 20 : 22, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            {streak}
          </span>
          <span style={{ fontSize: isMobile ? 11 : 13, color: 'var(--ink-3)', fontWeight: 500, lineHeight: 1 }}>
            {isMobile ? 'd' : 'day streak'}
          </span>
        </div>
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: isMobile ? 5 : 10,
          marginTop: isMobile ? 14 : 18,
        }}
      >
        {weekDates.map(({ dayLabel, date, dateNum }) => {
          const state = getState(date)
          return (
            <div
              key={dayLabel}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <div
                className="de-eyebrow"
                style={{ fontSize: isMobile ? 9 : 10, color: 'var(--ink-3)', textTransform: 'uppercase' }}
              >
                {isMobile ? dayLabel.slice(0, 1) : dayLabel}
              </div>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  maxWidth: cellSize,
                  borderRadius: isMobile ? 10 : 14,
                  display: 'grid',
                  placeItems: 'center',
                  background:
                    state === 'done' ? 'var(--green-soft)'
                    : state === 'today' ? 'white'
                    : 'var(--surface-2)',
                  border:
                    state === 'today'
                      ? '2px dashed var(--blue)'
                      : '1px solid var(--border)',
                  color: state === 'done' ? 'var(--green-deep)' : 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                {state === 'done' ? (
                  <Check size={isMobile ? 15 : 20} />
                ) : (
                  <span style={{ fontSize: isMobile ? 12 : 15 }}>{dateNum}</span>
                )}
                {state === 'today' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -6,
                      fontSize: 8,
                      color: 'var(--blue-deep)',
                      background: 'white',
                      padding: '1px 4px',
                      borderRadius: 999,
                      border: '1px solid var(--blue)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    today
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Badge progress */}
      <div
        style={{
          marginTop: isMobile ? 16 : 22,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '8px 10px' : '10px 14px',
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-sm)',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isMobile ? 12 : 13, color: 'var(--ink-2)', flex: 1, minWidth: 0 }}>
          <Trophy size={14} color="var(--gold)" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
            {streak >= 10
              ? '🎉 10-Day Devoted badge unlocked!'
              : `${10 - streak} more days → `}
            {streak < 10 && <b style={{ color: 'var(--ink)' }}>10-Day Devoted</b>}
          </span>
        </div>
        {/* View history: hidden on mobile to keep it compact */}
        {!isMobile && (
          <button
            className="de-btn ghost"
            style={{ height: 32, padding: '0 10px', fontSize: 12, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', flexShrink: 0 }}
          >
            View history
          </button>
        )}
      </div>
    </div>
  )
}
