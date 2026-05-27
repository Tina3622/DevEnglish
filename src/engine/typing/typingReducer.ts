// Adapted from qwerty-learner
import { createContext } from 'react'

export interface Word {
  name: string
  trans: string[]
  usphone: string
  ukphone: string
  notation?: string
}

export interface WordWithIndex extends Word {
  index: number
}

export interface LetterMistakes {
  [letterIndex: number]: string[]
}

export interface UserInputLog {
  index: number
  correctCount: number
  wrongCount: number
  LetterMistakes: LetterMistakes
}

export interface ChapterData {
  words: WordWithIndex[]
  index: number
  wordCount: number
  correctCount: number
  wrongCount: number
  userInputLogs: UserInputLog[]
  wordRecordIds: number[]
}

export interface TimerData {
  time: number
  accuracy: number
  wpm: number
}

export interface TypingState {
  chapterData: ChapterData
  timerData: TimerData
  isTyping: boolean
  isFinished: boolean
  isShowSkip: boolean
  isTransVisible: boolean
  isLoopSingleWord: boolean
  isSavingRecord: boolean
}

export const initialUserInputLog: UserInputLog = {
  index: 0,
  correctCount: 0,
  wrongCount: 0,
  LetterMistakes: {},
}

export const initialState: TypingState = {
  chapterData: {
    words: [],
    index: 0,
    wordCount: 0,
    correctCount: 0,
    wrongCount: 0,
    userInputLogs: [],
    wordRecordIds: [],
  },
  timerData: { time: 0, accuracy: 0, wpm: 0 },
  isTyping: false,
  isFinished: false,
  isShowSkip: false,
  isTransVisible: false,
  isLoopSingleWord: false,
  isSavingRecord: false,
}

export type TypingAction =
  | { type: 'SET_WORDS'; payload: { words: WordWithIndex[] } }
  | { type: 'SET_INDEX'; payload: number }
  | { type: 'SET_COUNT'; payload: { correctCount: number; wrongCount: number } }
  | { type: 'SET_TIMER'; payload: { time: number; accuracy: number; wpm: number } }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_FINISHED'; payload: boolean }
  | { type: 'SET_SHOW_SKIP'; payload: boolean }
  | { type: 'SET_TRANS_VISIBLE'; payload: boolean }
  | { type: 'SET_LOOP_SINGLE_WORD'; payload: boolean }
  | { type: 'SAVING_RECORD'; payload: boolean }
  | { type: 'RESET' }

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function mergeLetterMistake(
  existing: LetterMistakes,
  incoming: LetterMistakes,
): LetterMistakes {
  const merged = { ...existing }
  for (const [pos, keys] of Object.entries(incoming)) {
    const idx = Number(pos)
    if (!merged[idx]) merged[idx] = []
    merged[idx].push(...keys)
  }
  return merged
}

export function typingReducer(state: TypingState, action: TypingAction): TypingState {
  switch (action.type) {
    case 'SET_WORDS':
      return { ...state, chapterData: { ...state.chapterData, words: action.payload.words } }
    case 'SET_INDEX':
      return { ...state, chapterData: { ...state.chapterData, index: action.payload } }
    case 'SET_COUNT':
      return {
        ...state,
        chapterData: {
          ...state.chapterData,
          correctCount: action.payload.correctCount,
          wrongCount: action.payload.wrongCount,
        },
      }
    case 'SET_TIMER':
      return { ...state, timerData: action.payload }
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload }
    case 'SET_FINISHED':
      return { ...state, isFinished: action.payload }
    case 'SET_SHOW_SKIP':
      return { ...state, isShowSkip: action.payload }
    case 'SET_TRANS_VISIBLE':
      return { ...state, isTransVisible: action.payload }
    case 'SET_LOOP_SINGLE_WORD':
      return { ...state, isLoopSingleWord: action.payload }
    case 'SAVING_RECORD':
      return { ...state, isSavingRecord: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export const TypingContext = createContext<{
  state: TypingState
  dispatch: React.Dispatch<TypingAction>
} | null>(null)
