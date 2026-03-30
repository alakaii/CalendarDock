import { useCalendars } from '../../hooks/useCalendars'
import { useSettingsStore } from '../../store/settings.slice'

const PRESET_COLORS = [
  '#4285F4', '#0F9D58', '#DB4437', '#F4B400',
  '#9C27B0', '#00BCD4', '#FF5722', '#795548',
  '#607D8B', '#E91E63', '#009688', '#FF9800'
]

export default function CalendarSelector() {
  const { data: calendars = [], isLoading, isError, error, refetch } = useCalendars()
  const calendarPreferences = useSettingsStore((s) => s.calendarPreferences)
  const setCalendarVisible = useSettingsStore((s) => s.setCalendarVisible)
  const setAllCalendarsVisible = useSettingsStore((s) => s.setAllCalendarsVisible)
  const setCalendarColor = useSettingsStore((s) => s.setCalendarColor)
  const accounts = useSettingsStore((s) => s.accounts)

  if (isLoading) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading calendars...</p>
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : String(error)
    const isApiDisabled = msg.includes('has not been used') || msg.includes('disabled') || msg.includes('API')
    return (
      <div className="space-y-3 max-w-lg">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Calendars</h3>
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm font-semibold text-red-500 mb-1">Failed to load calendars</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{msg}</p>
        </div>
        {isApiDisabled && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs font-semibold text-blue-500 mb-1">Enable the Google Calendar API</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Go to <span className="font-mono">console.cloud.google.com</span> → APIs &amp; Services → Library →
              search "Google Calendar API" → Enable. Also enable "Tasks API" for the Lists tab.
            </p>
          </div>
        )}
        <button
          onClick={() => refetch()}
          className="text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors"
        >
          Retry →
        </button>
      </div>
    )
  }

  if (accounts.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No accounts connected. Add one in Accounts.</p>
  }

  if (calendars.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No calendars found.</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-blue-500 hover:text-blue-400">Retry →</button>
      </div>
    )
  }

  // Group by account
  const byAccount = accounts.map((acc) => ({
    account: acc,
    calendars: calendars.filter((c) => c.accountId === acc.id)
  })).filter((g) => g.calendars.length > 0)

  const allIds = calendars.map((c) => c.id)

  return (
    <div>
      {/* Header with global bulk controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Calendars</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>All:</span>
          <button
            onClick={() => setAllCalendarsVisible(allIds, true)}
            className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
          >
            Show
          </button>
          <button
            onClick={() => setAllCalendarsVisible(allIds, false)}
            className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Hide
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {byAccount.map(({ account, calendars: cals }) => {
          const calIds = cals.map((c) => c.id)
          return (
            <div key={account.id}>
              {/* Account row with per-account bulk toggle */}
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {account.email}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAllCalendarsVisible(calIds, true)}
                    className="text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.08)' }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAllCalendarsVisible(calIds, false)}
                    className="text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {cals.map((cal) => {
                  const pref = calendarPreferences[cal.id]
                  const isVisible = pref?.visible !== false
                  const color = pref?.colorOverride ?? cal.backgroundColor

                  return (
                    <div key={cal.id} className="flex items-center gap-3 py-2">
                      {/* Visibility toggle */}
                      <button
                        onClick={() => setCalendarVisible(cal.id, !isVisible)}
                        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          backgroundColor: isVisible ? color : 'transparent',
                          borderColor: isVisible ? color : 'var(--text-secondary)'
                        }}
                        aria-label={isVisible ? 'Hide calendar' : 'Show calendar'}
                      >
                        {isVisible && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <span
                        className="flex-1 text-sm"
                        style={{
                          color: 'var(--text-primary)',
                          opacity: isVisible ? 1 : 0.4
                        }}
                      >
                        {cal.summary}
                      </span>

                      {/* Color swatches */}
                      <div className="flex gap-1">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setCalendarColor(cal.id, c)}
                            className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                            style={{
                              backgroundColor: c,
                              borderColor: color === c ? 'white' : 'transparent'
                            }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tip for new users */}
      <p className="mt-4 text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
        Tip: tap <strong>Hide</strong> to hide all, then check only the calendars you want to see.
      </p>
    </div>
  )
}
