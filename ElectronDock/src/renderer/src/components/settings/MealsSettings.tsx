import { useSettingsStore } from '../../store/settings.slice'
import { useGoogleTaskLists } from '../../hooks/useGoogleTasks'

export default function MealsSettings() {
  const accounts              = useSettingsStore((s) => s.accounts)
  const choresLists           = useSettingsStore((s) => s.choresLists)
  const mealsGoogleAccountId  = useSettingsStore((s) => s.mealsGoogleAccountId)
  const mealsGoogleTaskListId = useSettingsStore((s) => s.mealsGoogleTaskListId)
  const setMealsGoogleTaskList = useSettingsStore((s) => s.setMealsGoogleTaskList)

  const accountIds = accounts.map((a) => a.id)
  const { data: googleTaskLists = [], isLoading } = useGoogleTaskLists(accountIds)

  // IDs reserved by Chores — cannot be selected for Meals
  const reservedIds = new Set<string>(
    choresLists
      .filter((cl) => cl.googleAccountId && cl.googleTaskListId)
      .map((cl) => `${cl.googleAccountId}::${cl.googleTaskListId}`)
  )

  const currentValue =
    mealsGoogleAccountId && mealsGoogleTaskListId
      ? `${mealsGoogleAccountId}::${mealsGoogleTaskListId}`
      : ''

  const handleChange = (value: string) => {
    if (!value) {
      setMealsGoogleTaskList('', '')
      return
    }
    const [accountId, taskListId] = value.split('::')
    setMealsGoogleTaskList(accountId, taskListId)
  }

  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Meals</h2>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        The meal planner works offline by default. Optionally link a Google Tasks list to show
        a Tasks tab alongside the weekly meal grid — useful for a shared grocery or prep list.
      </p>

      {/* Google Tasks link */}
      <div className="space-y-2">
        <p style={labelStyle}>Google Tasks list (optional)</p>

        {accounts.length === 0 ? (
          <p className="text-sm" style={{ color: '#f59e0b' }}>
            No Google accounts connected — add one in Accounts settings.
          </p>
        ) : isLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : (
          <select
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl outline-none min-h-[44px]"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">— no linked list (offline only) —</option>
            {googleTaskLists.map((tl) => {
              const key      = `${tl.accountId}::${tl.id}`
              const account  = accounts.find((a) => a.id === tl.accountId)
              const reserved = reservedIds.has(key)
              return (
                <option key={key} value={key} disabled={reserved}>
                  {tl.title}{account ? ` (${account.email})` : ''}{reserved ? ' — reserved by Chores' : ''}
                </option>
              )
            })}
          </select>
        )}

        {currentValue && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            A <strong>Tasks</strong> tab will appear on the Meals page showing tasks from this list.
          </p>
        )}
      </div>

      {/* Current link status */}
      {currentValue && (() => {
        const linked = googleTaskLists.find(
          (tl) => tl.accountId === mealsGoogleAccountId && tl.id === mealsGoogleTaskListId
        )
        const account = accounts.find((a) => a.id === mealsGoogleAccountId)
        return linked ? (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'var(--card-bg)', border: '1px solid #3b82f6' }}
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {linked.title}
              </p>
              {account && (
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {account.email}
                </p>
              )}
            </div>
            <button
              onClick={() => setMealsGoogleTaskList('', '')}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#ef4444' }}
            >
              Unlink
            </button>
          </div>
        ) : null
      })()}
    </div>
  )
}
