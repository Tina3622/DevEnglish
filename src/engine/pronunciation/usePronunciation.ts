// Adapted from qwerty-learner
import { Howl } from 'howler'
import { useCallback, useEffect, useRef, useState } from 'react'

export type PronunciationType = 'us' | 'uk'

export interface UsePronunciationResult {
  playPronunciation: (word: string, type?: PronunciationType) => void
  isPlaying: boolean
  stopPronunciation: () => void
}

const YOUDAO_API = 'https://dict.youdao.com/dictvoice?audio='

export function buildPronunciationUrl(word: string, type: PronunciationType = 'us'): string {
  const typeParam = type === 'uk' ? 1 : 2
  return `${YOUDAO_API}${encodeURIComponent(word)}&type=${typeParam}`
}

const howlCache = new Map<string, Howl>()

function getOrCreateHowl(url: string): Howl {
  if (howlCache.has(url)) return howlCache.get(url)!
  const howl = new Howl({ src: [url], html5: true, format: ['mp3'], preload: false })
  howlCache.set(url, howl)
  return howl
}

export function prefetchPronunciation(word: string, type: PronunciationType = 'us'): void {
  if (!word?.trim()) return
  const url = buildPronunciationUrl(word, type)
  getOrCreateHowl(url).load()
}

export function usePronunciation(): UsePronunciationResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const activeHowlRef = useRef<Howl | null>(null)

  const stopPronunciation = useCallback(() => {
    if (activeHowlRef.current) {
      activeHowlRef.current.stop()
      activeHowlRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const playPronunciation = useCallback(
    (word: string, type: PronunciationType = 'us') => {
      if (!word.trim()) return
      stopPronunciation()
      const url = buildPronunciationUrl(word, type)
      const howl = getOrCreateHowl(url)
      howl.off('play').off('end').off('playerror')
      howl.on('play', () => setIsPlaying(true))
      howl.on('end', () => { setIsPlaying(false); activeHowlRef.current = null })
      howl.on('playerror', () => { setIsPlaying(false); activeHowlRef.current = null })
      activeHowlRef.current = howl
      howl.play()
    },
    [stopPronunciation],
  )

  useEffect(() => {
    return () => { activeHowlRef.current?.stop() }
  }, [])

  return { playPronunciation, isPlaying, stopPronunciation }
}
