/* ================================================================
   QuizFlow — Anti-Cheating Suite & Focus Shield
   Monitors tab switches, window focus loss, prevents unauthorized
   clipboard/context menu, enforces fullscreen during question_active.
   ================================================================ */

import { useState, useEffect, useCallback, useRef } from 'react'

export type AntiCheatViolationReason =
  | 'tab_switch'
  | 'focus_loss'
  | 'copy_paste_attempt'
  | 'fullscreen_exit'
  | 'devtools_detected'

export interface AntiCheatViolationEvent {
  count: number
  reason: AntiCheatViolationReason
  timestamp: number
}

export interface AntiCheatOptions {
  onViolation?: (event: AntiCheatViolationEvent) => void
  onViolationReport?: (reason: string) => void  // fires after each violation to report to server
  blockCopyPaste?: boolean
  blockContextMenu?: boolean
  enforceFullscreen?: boolean  // if true, prompt fullscreen and track exit
  enabled?: boolean
}

// ── Fullscreen helpers ────────────────────────────────────────────

export function requestFullscreen() {
  const el = document.documentElement as any
  try {
    if (el.requestFullscreen) return el.requestFullscreen()
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen()
    if (el.mozRequestFullScreen) return el.mozRequestFullScreen()
  } catch {}
}

export function exitFullscreen() {
  const doc = document as any
  try {
    if (doc.exitFullscreen) return doc.exitFullscreen()
    if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen()
    if (doc.mozCancelFullScreen) return doc.mozCancelFullScreen()
  } catch {}
}

export function isFullscreen(): boolean {
  const doc = document as any
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement
  )
}

// ── AntiCheat Class ───────────────────────────────────────────────

export class AntiCheatShield {
  private count: number = 0
  private lastViolationTime: number = 0
  private options: AntiCheatOptions
  private isListening: boolean = false
  private devtoolsInterval: ReturnType<typeof setInterval> | null = null

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.recordViolation('tab_switch')
    }
  }

  private handleWindowBlur = () => {
    // Prevent double counting if visibilitychange already fired within 200ms
    const now = Date.now()
    if (now - this.lastViolationTime < 200) return
    this.recordViolation('focus_loss')
  }

  private handleCopyPaste = (e: Event) => {
    if (this.options.blockCopyPaste !== false) {
      e.preventDefault()
      e.stopPropagation()
      this.recordViolation('copy_paste_attempt')
    }
  }

  private handleContextMenu = (e: MouseEvent) => {
    if (this.options.blockContextMenu !== false) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  private handleFullscreenChange = () => {
    if (this.options.enforceFullscreen && !isFullscreen()) {
      this.recordViolation('fullscreen_exit')
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Block F12 / Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+U / Ctrl+S
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
      (e.ctrlKey && (e.key === 'U' || e.key === 'S' || e.key === 'P'))
    ) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  constructor(options: AntiCheatOptions = {}) {
    this.options = {
      blockCopyPaste: true,
      blockContextMenu: true,
      enforceFullscreen: true,
      enabled: true,
      ...options,
    }
  }

  public recordViolation(reason: AntiCheatViolationReason) {
    this.count += 1
    this.lastViolationTime = Date.now()
    const event: AntiCheatViolationEvent = {
      count: this.count,
      reason,
      timestamp: this.lastViolationTime,
    }
    if (this.options.onViolation) this.options.onViolation(event)
    if (this.options.onViolationReport) this.options.onViolationReport(reason)
  }

  public start() {
    if (typeof window === 'undefined' || this.isListening) return
    this.isListening = true

    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('blur', this.handleWindowBlur)
    document.addEventListener('keydown', this.handleKeyDown, true)

    if (this.options.blockCopyPaste !== false) {
      document.addEventListener('copy', this.handleCopyPaste)
      document.addEventListener('paste', this.handleCopyPaste)
      document.addEventListener('cut', this.handleCopyPaste)
    }

    if (this.options.blockContextMenu !== false) {
      document.addEventListener('contextmenu', this.handleContextMenu)
    }

    if (this.options.enforceFullscreen) {
      document.addEventListener('fullscreenchange', this.handleFullscreenChange)
      document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange)
    }

    // Devtools size heuristic: check every 2s
    this.devtoolsInterval = setInterval(() => {
      const threshold = 160
      const widthDiff = window.outerWidth - window.innerWidth > threshold
      const heightDiff = window.outerHeight - window.innerHeight > threshold
      if (widthDiff || heightDiff) {
        // Only record once per interval batch
        const now = Date.now()
        if (now - this.lastViolationTime > 5000) {
          this.recordViolation('devtools_detected')
        }
      }
    }, 2000)
  }

  public stop() {
    if (typeof window === 'undefined' || !this.isListening) return
    this.isListening = false

    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('blur', this.handleWindowBlur)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    document.removeEventListener('copy', this.handleCopyPaste)
    document.removeEventListener('paste', this.handleCopyPaste)
    document.removeEventListener('cut', this.handleCopyPaste)
    document.removeEventListener('contextmenu', this.handleContextMenu)
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange)

    if (this.devtoolsInterval) {
      clearInterval(this.devtoolsInterval)
      this.devtoolsInterval = null
    }
  }

  public getCount(): number { return this.count }
  public resetCount(): void { this.count = 0 }
}

/**
 * Functional initializer for vanilla JS / non-React usage
 */
export function initAntiCheat(options: AntiCheatOptions = {}) {
  const shield = new AntiCheatShield(options)
  shield.start()
  return {
    destroy: () => shield.stop(),
    getViolationCount: () => shield.getCount(),
    resetCount: () => shield.resetCount(),
  }
}

/**
 * React Hook for seamless integration in QuizFlow play components.
 * Also exposes fullscreen helpers.
 */
export function useAntiCheat(options: AntiCheatOptions = {}) {
  const [violationCount, setViolationCount] = useState(0)
  const [lastReason, setLastReason] = useState<AntiCheatViolationReason | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [fullscreenActive, setFullscreenActive] = useState(false)
  const shieldRef = useRef<AntiCheatShield | null>(null)
  const onViolationRef = useRef(options.onViolation)
  const onReportRef = useRef(options.onViolationReport)

  onViolationRef.current = options.onViolation
  onReportRef.current = options.onViolationReport

  // Track fullscreen state
  useEffect(() => {
    const onFsChange = () => setFullscreenActive(isFullscreen())
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    setFullscreenActive(isFullscreen())
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  useEffect(() => {
    if (options.enabled === false) return

    const shield = new AntiCheatShield({
      ...options,
      onViolation: (evt) => {
        setViolationCount(evt.count)
        setLastReason(evt.reason)
        setShowWarning(true)
        if (onViolationRef.current) onViolationRef.current(evt)
      },
      onViolationReport: (reason) => {
        if (onReportRef.current) onReportRef.current(reason)
      }
    })

    shieldRef.current = shield
    shield.start()

    return () => { shield.stop() }
  }, [options.enabled, options.blockCopyPaste, options.blockContextMenu, options.enforceFullscreen])

  const dismissWarning = useCallback(() => { setShowWarning(false) }, [])

  const resetCount = useCallback(() => {
    setViolationCount(0)
    setShowWarning(false)
    setLastReason(null)
    if (shieldRef.current) shieldRef.current.resetCount()
  }, [])

  const enterFullscreen = useCallback(() => {
    requestFullscreen()
  }, [])

  return {
    violationCount,
    lastReason,
    showWarning,
    dismissWarning,
    resetCount,
    fullscreenActive,
    enterFullscreen,
  }
}
