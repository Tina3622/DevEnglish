/**
 * 浏览器 Web Speech API 发音评估模块
 *
 * 零费用、零注册、零 API Key
 * - 收音：SpeechRecognition（webkit）
 * - 评分：Levenshtein 距离 + 单词命中率混合算法
 */

export interface AssessmentResult {
  /** 综合发音得分（0-100） */
  pronunciationScore: number
  /** 准确度（发音是否正确） */
  accuracyScore: number
  /** 流利度 */
  fluencyScore: number
  /** 完整度（读全了哪些词） */
  completenessScore: number
  /** 识别到的文本 */
  recognizedText: string
  /** 逐词评分详情 */
  words: { word: string; accuracyScore: number; errorType: string }[]
}

export type AssessmentHandle = {
  start: () => void
  cancel: () => void
}

/** Levenshtein 距离 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** 计算综合评分 */
function computeScores(reference: string, recognized: string): {
  overall: number; accuracy: number; fluency: number; completeness: number
} {
  const refWords = reference.toLowerCase().split(/\s+/).filter(Boolean)
  const recWords = recognized.toLowerCase().split(/\s+/).filter(Boolean)

  if (refWords.length === 0) {
    return { overall: 0, accuracy: 0, fluency: 0, completeness: 0 }
  }
  if (recWords.length === 0) {
    return { overall: 0, accuracy: 0, fluency: 0, completeness: 0 }
  }

  // 1️⃣ 单词命中率
  const refSet = new Set(refWords)
  let hits = 0
  recWords.forEach(w => { if (refSet.has(w)) hits++ })
  const wordHitRate = Math.min(1, hits / refWords.length)

  // 2️⃣ 字符级 Levenshtein 相似度
  const levDist = levenshtein(reference.toLowerCase(), recognized.toLowerCase())
  const maxLen = Math.max(reference.length, recognized.length)
  const charSimilarity = maxLen > 0 ? Math.max(0, 1 - levDist / maxLen) : 0

  // 3️⃣ 完整度：用户说了参考文本里多少个词
  const completeness = Math.min(1, recWords.length / refWords.length)

  // 4️⃣ 流利度：单词命中 + 字符相似混合
  const fluency = wordHitRate * 0.6 + charSimilarity * 0.4

  // 5️⃣ 准确度
  const accuracy = wordHitRate * 0.5 + charSimilarity * 0.5

  // 6️⃣ 综合
  const overall = accuracy * 0.5 + fluency * 0.3 + completeness * 0.2

  return {
    overall: Math.round(Math.min(100, overall * 100)),
    accuracy: Math.round(Math.min(100, accuracy * 100)),
    fluency: Math.round(Math.min(100, fluency * 100)),
    completeness: Math.round(Math.min(100, completeness * 100)),
  }
}

/**
 * 使用浏览器原生 Web Speech API 评估发音
 *
 * @param referenceText  参考文本
 * @param onResult       完成回调
 * @param onError        出错回调
 */
export function assessPronunciation(
  referenceText: string,
  onResult: (result: AssessmentResult) => void,
  onError: (err: string) => void,
): AssessmentHandle {
  let cancelled = false
  let recognition: any = null
  let gotResult = false

  return {
    start: () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        onError('您的浏览器不支持语音识别（推荐 Chrome 或 Edge）')
        return
      }

      recognition = new SpeechRecognition()
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.continuous = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        if (cancelled) return
        gotResult = true
        const transcript = event.results[0][0].transcript

        const scores = computeScores(referenceText, transcript)

        onResult({
          pronunciationScore: scores.overall,
          accuracyScore: scores.accuracy,
          fluencyScore: scores.fluency,
          completenessScore: scores.completeness,
          recognizedText: transcript,
          words: transcript.split(/\s+/).map((w: string) => ({
            word: w,
            accuracyScore: referenceText.toLowerCase().includes(w.toLowerCase()) ? 100 : 0,
            errorType: referenceText.toLowerCase().includes(w.toLowerCase()) ? 'None' : 'Mispronunciation',
          })),
        })
      }

      recognition.onerror = () => {
        if (cancelled) return
        gotResult = true
        onError('语音识别失败，请检查麦克风权限')
      }

      recognition.onend = () => {
        if (cancelled) return
        // 如果识别完成但没有触发 result/error（超时或其他）
        if (!gotResult) {
          onError('未识别到语音，请靠近麦克风重试')
        }
      }

      recognition.start()
    },
    cancel: () => {
      cancelled = true
      if (recognition) {
        try { recognition.onend = null; recognition.onresult = null; recognition.onerror = null; recognition.stop() } catch { /* ignore */ }
        recognition = null
      }
    },
  }
}
