// Adapted from qwerty-learner
import { useCallback, useRef } from 'react'
import { Howl } from 'howler'

export interface UseKeySoundsResult {
  playCorrect: () => void
  playWrong: () => void
  playComplete: () => void
  setVolume: (v: number) => void
}

function lazyHowl(src: string): () => Howl {
  let howl: Howl | null = null
  return () => {
    if (!howl) {
      howl = new Howl({ src: [src], volume: 0.3, preload: true })
    }
    return howl
  }
}

const getClick = lazyHowl('/sounds/click.wav')
const getBeep = lazyHowl('/sounds/beep.wav')
const getCorrect = lazyHowl('/sounds/correct.wav')

export function useKeySounds(): UseKeySoundsResult {
  const volumeRef = useRef(0.3)

  const playCorrect = useCallback(() => {
    getClick().volume(volumeRef.current)
    getClick().play()
  }, [])

  const playWrong = useCallback(() => {
    getBeep().volume(volumeRef.current)
    getBeep().play()
  }, [])

  const playComplete = useCallback(() => {
    getCorrect().volume(volumeRef.current)
    getCorrect().play()
  }, [])

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v
  }, [])

  return { playCorrect, playWrong, playComplete, setVolume }
}
