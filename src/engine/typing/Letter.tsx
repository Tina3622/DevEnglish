// Adapted from qwerty-learner
import React from 'react'

export type LetterState = 'normal' | 'correct' | 'wrong'

export interface LetterProps {
  letter: string
  state?: LetterState
  visible?: boolean
}

export const EXPLICIT_SPACE = '␣'

const STATE_CLASS: Record<string, Record<LetterState, string>> = {
  letter: {
    normal:  'de-letter-normal',
    correct: 'de-letter-correct',
    wrong:   'de-letter-wrong',
  },
  space: {
    normal:  'de-letter-space-normal',
    correct: 'de-letter-space-correct',
    wrong:   'de-letter-space-wrong',
  },
}

const Letter: React.FC<LetterProps> = ({ letter, state = 'normal', visible = true }) => {
  const variant = letter === EXPLICIT_SPACE ? 'space' : 'letter'
  const className = `de-letter ${STATE_CLASS[variant][state]}`
  return <span className={className}>{visible ? letter : '_'}</span>
}

export default React.memo(Letter)
