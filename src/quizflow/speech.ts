/* ================================================================
   QuizFlow — Web Speech TTS Engine
   Native Web Speech API helper for reading question prompts
   and diagnostic explanations aloud with zero external dependencies.
   ================================================================ */

/**
 * Reads text aloud using native Web Speech API Synthesis
 */
export function speakText(text: string, lang: string = 'en-US'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('[QuizFlow Speech] Web Speech API is not supported in this browser environment.')
    return
  }

  try {
    // Cancel any active speech synthesis before speaking new text
    window.speechSynthesis.cancel()

    if (!text || text.trim() === '') return

    const utterance = new SpeechSynthesisUtterance(text.trim())
    utterance.lang = lang
    utterance.rate = 0.95 // slightly measured rate for clarity
    utterance.pitch = 1.05 // pleasant pitch

    // Attempt to pick a high quality voice if available
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      const preferredVoice = voices.find(
        v => v.lang.startsWith(lang.slice(0, 2)) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
      ) || voices.find(v => v.lang.startsWith(lang.slice(0, 2)))
      if (preferredVoice) {
        utterance.voice = preferredVoice
      }
    }

    window.speechSynthesis.speak(utterance)
  } catch (err) {
    console.error('[QuizFlow Speech] Error executing speech synthesis:', err)
  }
}

/**
 * Stops any active text-to-speech utterance
 */
export function stopSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
  } catch {}
}

/**
 * Returns true if Web Speech API is currently speaking
 */
export function isSpeaking(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  return window.speechSynthesis.speaking
}

/**
 * Toggles reading text aloud — stops if currently speaking, or speaks text if silent
 * Returns boolean indicating whether speech was started (true) or stopped (false)
 */
export function toggleSpeech(text: string, lang: string = 'en-US'): boolean {
  if (isSpeaking()) {
    stopSpeech()
    return false
  } else {
    speakText(text, lang)
    return true
  }
}
