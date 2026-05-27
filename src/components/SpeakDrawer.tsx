import { useRef, useState, useCallback } from 'react'
import { Volume, Mic, Refresh } from './Icons'
import { useSpeech } from '../engine/pronunciation/useSpeech'
import { assessPronunciation } from '../lib/speechAssessment'
import type { AssessmentResult } from '../lib/speechAssessment'

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 100, fontSize: 12, color: 'var(--ink-2)' }}>{label}</div>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${value}%`,
          background: value >= 80 ? 'var(--green)' : value >= 60 ? 'var(--blue)' : 'var(--peach)',
          borderRadius: 999, transition: 'width 0.6s ease',
        }} />
      </div>
      <div className="de-mono" style={{ width: 36, textAlign: 'right', fontSize: 13 }}>{value}</div>
    </div>
  )
}

interface SpeakDrawerProps {
  /** 要朗读的参考文本 */
  sentence: string
  /** 可选翻译/释义 */
  translation?: string
}

/**
 * 口语跟读抽屜内容
 * 包含：参考文本展示 + 录音按钮 + Azure 评分结果
 */
export default function SpeakDrawer({ sentence, translation }: SpeakDrawerProps) {
  const { speak } = useSpeech()
  const assessmentRef = useRef<{ cancel: () => void } | null>(null)

  const [recState, setRecState] = useState<'idle' | 'recording' | 'analyzing' | 'done'>('idle')
  const [score, setScore] = useState<{ overall: number; pron: number; flu: number; rhythm: number } | null>(null)
  const [micResult, setMicResult] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const applyAzureScore = useCallback((assessment: AssessmentResult) => {
    setMicResult(assessment.recognizedText)
    setScore({
      overall: Math.round(assessment.pronunciationScore),
      pron: Math.round(assessment.accuracyScore),
      flu: Math.round(assessment.fluencyScore),
      rhythm: Math.round(assessment.completenessScore),
    })
    setRecState('done')
  }, [])

  const startRecording = useCallback(() => {
    setRecState('recording')
    setMicResult('')
    setScore(null)
    setError(null)

    if (!sentence) {
      setError('没有参考文本')
      setRecState('idle')
      return
    }

    const handle = assessPronunciation(
      sentence,
      (result) => {
        setRecState('analyzing')
        setTimeout(() => applyAzureScore(result), 400)
      },
      (err) => {
        console.warn('Azure assessment error:', err)
        setError(err)
        setRecState('done')
      },
    )

    assessmentRef.current = handle
    handle.start()
  }, [sentence, applyAzureScore])

  const handleMic = useCallback(() => {
    if (recState === 'idle' || recState === 'done') {
      startRecording()
    } else if (recState === 'recording') {
      assessmentRef.current?.cancel()
      assessmentRef.current = null
      setRecState('analyzing')
      setTimeout(() => setRecState('done'), 600)
    }
  }, [recState, startRecording])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 句子展示 */}
      <div>
        <div className="de-eyebrow" style={{ marginBottom: 6 }}>朗读句子</div>
        <div style={{
          padding: '16px 18px', background: 'var(--blue-tint)', borderRadius: 'var(--r-md)',
          border: '1px solid var(--blue-soft)', fontSize: 17, lineHeight: 1.6,
          fontFamily: 'var(--font-mono)', color: 'var(--ink)',
        }}>
          {sentence}
        </div>
        {translation && (
          <div className="de-zh" style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)' }}>
            {translation}
          </div>
        )}
      </div>

      {/* 发音按钮 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={(e) => { e.stopPropagation(); speak(sentence) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--card)', cursor: 'pointer',
            fontSize: 13, fontFamily: 'var(--font-sans)',
            color: 'var(--ink-2)',
          }}
        >
          <Volume size={16} /> 听原音播放
        </button>
      </div>

      {/* 录音按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <button onClick={handleMic}
          style={{
            width: 80, height: 80, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: recState === 'recording'
              ? 'linear-gradient(135deg, var(--peach), var(--peach-deep))'
              : 'linear-gradient(135deg, var(--blue), var(--blue-deep))',
            color: 'white', display: 'grid', placeItems: 'center',
            boxShadow: recState === 'recording'
              ? '0 0 0 10px rgba(212,160,121,0.15), 0 12px 30px rgba(212,160,121,0.3)'
              : '0 12px 30px rgba(108,132,179,0.35)',
            transition: 'all 0.2s',
          }}>
          <Mic size={32} color="white" />
        </button>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
          {recState === 'idle' && '点击麦克风开始跟读'}
          {recState === 'recording' && '录音中… 读完自动停止'}
          {recState === 'analyzing' && 'Azure AI 评分中…'}
          {recState === 'done' && '点击重新录音'}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--r-md)',
          background: 'var(--peach-soft)', border: '1px solid var(--peach)',
          color: 'var(--peach-deep)', fontSize: 12,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 评分结果 */}
      {score && (
        <div style={{ padding: '16px 18px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
          <div className="de-eyebrow" style={{ marginBottom: 10 }}>Azure AI 发音评分</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 40, fontWeight: 600, fontFamily: 'var(--font-mono)',
              color: score.overall >= 80 ? 'var(--green-deep)' : score.overall >= 60 ? 'var(--blue-deep)' : 'var(--peach-deep)'
            }}>{score.overall}</span>
            <span style={{ fontSize: 18, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>/ 100</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Metric label="Pronunciation 发音" value={score.pron} />
            <Metric label="Fluency 流利度" value={score.flu} />
            <Metric label="Rhythm 完整度" value={score.rhythm} />
          </div>
          {micResult && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
              🎤 识别结果: "{micResult}"
            </div>
          )}
        </div>
      )}

      {/* 再来一次 */}
      {recState === 'done' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => { setRecState('idle'); setScore(null); setMicResult(''); setError(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--card)', cursor: 'pointer',
              fontSize: 13, color: 'var(--ink-2)',
            }}
          >
            <Refresh size={14} /> 再来一次
          </button>
        </div>
      )}
    </div>
  )
}
