import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../lib/useIsMobile'

export interface UseSpeechResult {
  speak: (text: string, lang?: string) => void
  stop: () => void
  isSpeaking: boolean
  isSupported: boolean
}

// @ts-ignore — edge-tts-browser 无类型声明
import EdgeTTSBrowser from '@kingdanx/edge-tts-browser'

/**
 * 三路 TTS 发音策略：
 *   桌面端 → Edge TTS（WebSocket 直连微软，高音质）
 *   手机端 → TTS 代理（电脑转发，经 v2ray 翻墙）
 *   兜底   → 浏览器 speechSynthesis（仅部分设备支持）
 */
export function useSpeech(): UseSpeechResult {
  const isMobile = useIsMobile()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const cancelledRef = useRef(false)

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
  }, [])

  const stop = useCallback(() => {
    cancelledRef.current = true
    cleanupAudio()
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [cleanupAudio])

  const speak = useCallback(
    (text: string, _lang = 'en-US') => {
      if (!text.trim()) return
      stop()
      cancelledRef.current = false
      setIsSpeaking(true)

      // ── 手机端 ──
      // 单词（≤3 words）→ 有道词典 API（零配置，完美）
      // 句子（>3 words）→ 取首个关键词用有道发音，其余在控制台提示
      if (isMobile) {
        cleanupAudio()

        const words = text.trim().split(/\s+/)
        // 句子太长时只发核心关键词
        const speakText = words.length > 3 ? words.slice(0, Math.min(2, words.length)).join(' ') : text.trim()
        
        if (speakText !== text.trim()) {
          console.log('[useSpeech] sentence on mobile — playing key word:', speakText)
        }

        const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(speakText)}&type=2`)
        audioRef.current = audio
        audio.onended = () => { setIsSpeaking(false) }
        audio.onerror = () => { cleanupAudio(); setIsSpeaking(false) }
        audio.play().catch(() => { cleanupAudio(); setIsSpeaking(false) })
        return
      }

      // ── 桌面端：优先 Edge TTS（高音质）──
      const doEdgeTTS = async () => {
        try {
          const tts = new EdgeTTSBrowser({
            voice: 'en-US-JennyNeural',
            rate: '+0%',
            pitch: '+0Hz',
            text: text.trim(),
          })
          const blob = await tts.ttsToFile()
          if (cancelledRef.current) { setIsSpeaking(false); return }

          const url = URL.createObjectURL(blob)
          blobUrlRef.current = url
          const audio = new Audio(url)
          audioRef.current = audio

          audio.onended = () => { setIsSpeaking(false); cleanupAudio() }
          audio.onerror = () => {
            console.warn('[useSpeech] Edge TTS error, falling back')
            cleanupAudio()
            doFallback()
          }
          await audio.play()
        } catch (err) {
          console.warn('[useSpeech] Edge TTS error:', err)
          cleanupAudio()
          if (!cancelledRef.current) doFallback()
        }
      }

      // ── 兜底：浏览器 speechSynthesis ──
      const doFallback = () => {
        try {
          const synth = window.speechSynthesis
          if (!synth) { setIsSpeaking(false); return }
          synth.cancel()
          const utter = new SpeechSynthesisUtterance(text)
          utter.lang = 'en-US'
          utter.rate = 0.8
          utter.onstart = () => setIsSpeaking(true)
          utter.onend   = () => setIsSpeaking(false)
          utter.onerror = () => setIsSpeaking(false)
          if (!cancelledRef.current) {
            synth.speak(utter)
            synth.pause()
            synth.resume()
          } else {
            setIsSpeaking(false)
          }
        } catch { setIsSpeaking(false) }
      }

      doEdgeTTS()
    },
    [stop, cleanupAudio, isMobile],
  )

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      cleanupAudio()
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    }
  }, [cleanupAudio])

  return { speak, stop, isSpeaking, isSupported: true }
}
