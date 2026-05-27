// Adapted from qwerty-learner
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Letter, { EXPLICIT_SPACE } from './Letter'
import { useKeyHandler } from './keyEventHandler'

export interface LetterMistakes { [letterIndex: number]: string[] }

export interface WordResult {
  word: string
  wrongCount: number
  correctCount: number
  letterTimeArray: number[]
  letterMistake: LetterMistakes
}

export interface WordComponentProps {
  word: string
  isTyping: boolean
  onFinish: (result: WordResult) => void
  ignoreCase?: boolean
  onCorrectChar?: () => void
  onWrongChar?: () => void
  onWordComplete?: () => void
}

type LetterState = 'normal' | 'correct' | 'wrong'

export default function WordComponent({
  word,
  isTyping,
  onFinish,
  ignoreCase = false,
  onCorrectChar,
  onWrongChar,
  onWordComplete,
}: WordComponentProps) {
  const displayWord = word.replace(/ /g, EXPLICIT_SPACE)

  // Mutable state (refs to avoid stale closures in key handler)
  const inputWordRef = useRef('')
  const letterStatesRef = useRef<LetterState[]>(new Array(displayWord.length).fill('normal'))
  const correctCountRef = useRef(0)
  const wrongCountRef = useRef(0)
  const letterTimesRef = useRef<number[]>([])
  const mistakesRef = useRef<LetterMistakes>({})

  // Stable refs for callbacks so key handler always calls the latest
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const onCorrectRef = useRef(onCorrectChar)
  onCorrectRef.current = onCorrectChar
  const onWrongRef = useRef(onWrongChar)
  onWrongRef.current = onWrongChar
  const onWordCompleteRef = useRef(onWordComplete)
  onWordCompleteRef.current = onWordComplete

  // Force re-render to reflect state changes
  const [, setTick] = useState(0)
  const tick = () => setTick(t => t + 1)

  // Reset when word changes
  const prevWord = useRef('')
  useEffect(() => {
    if (prevWord.current === word) return
    prevWord.current = word
    inputWordRef.current = ''
    letterStatesRef.current = new Array(displayWord.length).fill('normal')
    correctCountRef.current = 0
    wrongCountRef.current = 0
    letterTimesRef.current = []
    mistakesRef.current = {}
    tick()
  }, [word, displayWord])

  useKeyHandler({
    isActive: isTyping,
    onChar: useCallback((char: string) => {
      const pos = inputWordRef.current.length
      if (pos >= displayWord.length) return

      const expected = ignoreCase ? displayWord[pos].toLowerCase() : displayWord[pos]
      const typed = ignoreCase ? char.toLowerCase() : char

      if (typed === expected) {
        letterStatesRef.current[pos] = 'correct'
        correctCountRef.current++
        letterTimesRef.current.push(Date.now())
        inputWordRef.current += char
        tick()
        onCorrectRef.current?.()

        if (inputWordRef.current.length === displayWord.length) {
          const result: WordResult = {
            word: displayWord.replace(EXPLICIT_SPACE, ' '),
            wrongCount: wrongCountRef.current,
            correctCount: correctCountRef.current,
            letterTimeArray: letterTimesRef.current,
            letterMistake: { ...mistakesRef.current },
          }
          inputWordRef.current = ''
          letterStatesRef.current = new Array(displayWord.length).fill('normal')
          correctCountRef.current = 0
          wrongCountRef.current = 0
          letterTimesRef.current = []
          mistakesRef.current = {}
          onWordCompleteRef.current?.()
          setTimeout(() => onFinishRef.current(result), 300)
        }
      } else {
        letterStatesRef.current[pos] = 'wrong'
        wrongCountRef.current++
        if (!mistakesRef.current[pos]) mistakesRef.current[pos] = []
        mistakesRef.current[pos].push(char)
        tick()
        onWrongRef.current?.()
        setTimeout(() => {
          letterStatesRef.current[pos] = 'normal'
          tick()
        }, 300)
      }
    }, [displayWord, ignoreCase]),
  })

  const inputLen = inputWordRef.current.length
  const states = letterStatesRef.current

  return (
    <span>
      {displayWord.split('').map((ch, i) => (
        <Letter
          key={i}
          letter={ch}
          state={states[i]}
          visible={i < inputLen || states[i] === 'correct'}
        />
      ))}
    </span>
  )
}
