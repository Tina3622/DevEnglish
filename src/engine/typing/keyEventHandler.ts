// Adapted from qwerty-learner
import { useCallback, useEffect } from 'react'

export interface UseKeyHandlerOptions {
  isActive: boolean
  onChar: (char: string, event: KeyboardEvent) => void
  onBackspace?: (event: KeyboardEvent) => void
}

const BANNED_KEYS = new Set([
  'Enter', 'Backspace', 'Delete', 'Tab', 'CapsLock',
  'Shift', 'Control', 'Alt', 'Meta', 'Escape',
  'Fn', 'FnLock', 'Hyper', 'Super', 'OS',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute',
  'End', 'PageDown', 'PageUp', 'Clear', 'Home',
])

const isLegal = (key: string): boolean => !BANNED_KEYS.has(key)

const isChineseSymbol = (val: string): boolean =>
  /[。？！，、；：“”‘’（）《》〈〉【】『』「」﹃﹄〔〕…—～﹏￥]/.test(val)

export function useKeyHandler({ isActive, onChar, onBackspace }: UseKeyHandlerOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isChineseSymbol(e.key)) {
        alert('您正在使用输入法，请先关闭输入法。')
        return
      }
      if (e.key === 'Backspace' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        onBackspace?.(e)
        return
      }
      if (isLegal(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
        onChar(e.key, e)
      }
    },
    [onChar, onBackspace],
  )

  useEffect(() => {
    if (!isActive) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, handleKeyDown])
}
