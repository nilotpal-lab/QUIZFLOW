/* ================================================================
   QuizFlow — Day-of Gate State (shared server-side computation)
   The gate decides whether student login is accepted. The admin
   controls it two ways, with the manual toggle winning:
     * login_open = true            → OPEN (admin override, any time)
     * opens_at / closes_at schedule → open inside the window
   ================================================================ */

export type GateState = 'closed' | 'closed_before' | 'open' | 'closed_after'

export interface EventConfig {
  login_open: boolean
  opens_at: string | null
  closes_at: string | null
}

export function computeGateState(
  cfg: EventConfig | null | undefined,
  now: Date = new Date()
): GateState {
  if (!cfg) return 'closed'
  if (cfg.login_open) return 'open'

  const opens = cfg.opens_at ? new Date(cfg.opens_at) : null
  const closes = cfg.closes_at ? new Date(cfg.closes_at) : null

  if (opens && now < opens) return 'closed_before'
  if (closes && now >= closes) return 'closed_after'
  // No schedule and toggle off → manually closed by the admin.
  return 'closed'
}

/** User-facing copy for each gate state. */
export function gateStateMessage(state: GateState, cfg: EventConfig | null): string {
  switch (state) {
    case 'open':
      return 'Student login is open. Contestants can join now.'
    case 'closed_before':
      return cfg?.opens_at
        ? `Student login opens on ${new Date(cfg.opens_at).toLocaleString()}.`
        : 'Student login is not open yet.'
    case 'closed_after':
      return 'The competition has ended. Login is closed.'
    default:
      return 'Student login is currently closed by the admin.'
  }
}
