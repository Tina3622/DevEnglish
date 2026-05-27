import React from 'react'

interface IconProps {
  size?: number
  color?: string
  strokeWidth?: number
  filled?: boolean
  style?: React.CSSProperties
  children?: React.ReactNode
  viewBox?: string
}

const Icon: React.FC<IconProps & { children?: React.ReactNode }> = ({
  size = 18,
  color = 'currentColor',
  strokeWidth = 1.6,
  children,
  viewBox = '0 0 24 24',
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {children}
  </svg>
)

// Search
export const Search: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

// Plus
export const Plus: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

// Keyboard
export const Keyboard: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
  </Icon>
)

// Camera
export const Camera: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.5-2h7L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
)

// Mic
export const Mic: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Icon>
)

// Sparkles
export const Sparkles: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
    <path d="M19 15l.8 1.8 1.8.7-1.8.8L19 20l-.8-1.7-1.8-.8 1.8-.7L19 15Z" />
  </Icon>
)

// ArrowRight
export const ArrowRight: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

// Chevron
export const Chevron: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

// Bell
export const Bell: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M6 17h12l-1.5-2v-4a4.5 4.5 0 0 0-9 0v4L6 17Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icon>
)

// Flip
export const Flip: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3 7h14a3 3 0 0 1 0 6h-2" />
    <path d="m6 10-3-3 3-3" />
    <path d="M21 17H7a3 3 0 0 1 0-6h2" />
    <path d="m18 14 3 3-3 3" />
  </Icon>
)

// Volume
export const Volume: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M4 9.5h3l5-4v13l-5-4H4z" />
    <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />
  </Icon>
)

// Star
export const Star: React.FC<IconProps & { filled?: boolean }> = ({ filled, ...p }) => (
  <Icon {...p}>
    <path
      d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
)

// Refresh
export const Refresh: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3M21 4v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3M3 20v-5h5" />
  </Icon>
)

// Play
export const Play: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M7 5v14l12-7L7 5Z" fill="currentColor" stroke="none" />
  </Icon>
)

// Check
export const Check: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
)

// X
export const X: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M6 18 18 6" />
  </Icon>
)

// Flame
export const Flame: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12 3.5c1.5 3 4.5 4.5 4.5 8.5a4.5 4.5 0 1 1-9 0c0-2 1-3 2-4-.5 1.5 0 2.5 1 2.5 0-3 .5-5 1.5-7z" />
  </Icon>
)

// Trophy
export const Trophy: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <path d="M5 5H3v2a3 3 0 0 0 4 2.8M19 5h2v2a3 3 0 0 1-4 2.8M9 14h6v3l1 3H8l1-3v-3Z" />
  </Icon>
)

// Book
export const Book: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5v0A1.5 1.5 0 0 0 5.5 21H19" />
    <path d="M8 7h7M8 11h7" />
  </Icon>
)

// Settings (cog)
export const Settings: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Icon>
)

// Headphones
export const Headphones: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
    <path d="M3 14a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2v-2ZM21 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z" />
  </Icon>
)

// Lightning
export const Lightning: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
  </Icon>
)

// User
export const User: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
  </Icon>
)
