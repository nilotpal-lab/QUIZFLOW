/* ================================================================
   QuizFlow — Anti-Cheating Suite & Focus Shield
   Monitors tab switches, window focus loss, and prevents unauthorized
   clipboard / context menu operations during quiz sessions.
   ================================================================ */

import { useState, useEffect, useCallback, useRef } from 'react'

export type AntiCheatViolationReason = 'tab_switch' | 'focus_loss' | 'copy_paste_attempt'

export interface AntiCheatViolationEvent {
  count: number
  reason: AntiCheatViolationReason
  timestamp: number
}

export interface AntiCheatOptions {
  onViolation?: (event: AntiCheatViolationEvent) => void
  blockCopyPaste?: boolean
  blockContextMenu?: boolean
  enabled?: boolean
}

/**
 * Class or controller for AntiCheat monitoring
 */
export class AntiCheatShield {
  private count: number = 0
  private lastViolationTime: number = 0
  private options: AntiCheatOptions
  private isListening: boolean = false

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

  constructor(options: AntiCheatOptions = {}) {
    this.options = {
      blockCopyPaste: true,
      blockContextMenu: true,
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
    if (this.options.onViolation) {
      this.options.onViolation(event)
    }
  }

  public start() {
    if (typeof window === 'undefined' || this.isListening) return

    this.isListening = true
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('blur', this.handleWindowBlur)

    if (this.options.blockCopyPaste !== false) {
      document.addEventListener('copy', this.handleCopyPaste)
      document.addEventListener('paste', this.handleCopyPaste)
      document.addEventListener('cut', this.handleCopyPaste)
    }

    if (this.options.blockContextMenu !== false) {
      document.addEventListener('contextmenu', this.handleContextMenu)
    }
  }

  public stop() {
    if (typeof window === 'undefined' || !this.isListening) return

    this.isListening = false
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('blur', this.handleWindowBlur)
    document.removeEventListener('copy', this.handleCopyPaste)
    document.removeEventListener('paste', this.handleCopyPaste)
    document.removeEventListener('cut', this.handleCopyPaste)
    document.removeEventListener('contextmenu', this.handleContextMenu)
  }

  public getCount(): number {
    return this.count
  }

  public resetCount(): void {
    this.count = 0
  }
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
 * React Hook for seamless integration in QuizFlow play components
 */
export function useAntiCheat(options: AntiCheatOptions = {}) {
  const [violationCount, setViolationCount] = useState(0)
  const [lastReason, setLastReason] = useState<AntiCheatViolationReason | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const shieldRef = useRef<AntiCheatShield | null>(null)
  const onViolationRef = useRef(options.onViolation)

  onViolationRef.current = options.onViolation

  useEffect(() => {
    if (options.enabled === false) return

    const shield = new AntiCheatShield({
      ...options,
      onViolation: (evt) => {
        setViolationCount(evt.count)
        setLastReason(evt.reason)
        setShowWarning(true)
        if (onViolationRef.current) {
          onViolationRef.current(evt)
        }
      },
    })

    shieldRef.current = shield
    shield.start()

    return () => {
      shield.stop()
    }
  }, [options.enabled, options.blockCopyPaste, options.blockContextMenu])

  const dismissWarning = useCallback(() => {
    setShowWarning(false)
  }, [])

  const resetCount = useCallback(() => {
    setViolationCount(0)
    setShowWarning(false)
    setLastReason(null)
    if (shieldRef.current) {
      shieldRef.current.resetCount()
    }
  }, [])

  return {
    violationCount,
    lastReason,
    showWarning,
    dismissWarning,
    resetCount,
  }
}
