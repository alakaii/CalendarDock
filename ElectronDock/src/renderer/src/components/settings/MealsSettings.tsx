import { useSettingsStore } from '../../store/settings.slice'
import { useGoogleTaskLists } from '../../hooks/useGoogleTasks'

/** Reusable task-list selector row used for both Meals Tasks and Fridge Panels. */
function TaskListSelector({
  label,
  description,
  currentAccountId,
  currentTaskListId,
  onChange,
  accounts,
  googleTaskLists,
  isLoading,
  reservedIds = new Set(),
}: {
  label: string
  description: string
  currentAccountId: string
  currentTaskListId: string
  onChange: (accountId: string, taskListId: string) => void
  accounts: { id: string; email: string }[]
  googleTaskLists: { id: string; title: string; accountId: string }[]
  isLoading: boolean
  reservedIds?: Set<string>
}) {
  const currentValue =
    currentAccountId && currentTaskListId
      ? `${currentAccountId}::${currentTaskListId}`
      : ''

  const handleChange = (value: string) => {
    if (!value) { onChange('', ''); return }
    const [accountId, taskListId] = value.split('::')
    onChange(accountId, taskListId)
  }

  const linked = googleTaskLists.find(
    (tl) => tl.accountId === currentAccountId && tl.id === currentTaskListId
  )
  const linkedAccount = accounts.find((a) => a.id === currentAccountId)

  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  return (
    <div className="space-y-2">
      <p style={labelStyle}>{label}</p>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>

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
          <option value="">— no linked list (local only) —</option>
          {googleTaskLists.map((tl) => {
            const key      = `${tl.accountId}::${tl.id}`
            const account  = accounts.find((a) => a.id === tl.accountId)
            const reserved = reservedIds.has(key)
            return (
              <option key={key} value={key} disabled={reserved}>
                {tl.title}{account ? ` (${account.email})` : ''}{reserved ? ' — reserved' : ''}
              </option>
            )
          })}
        </select>
      )}

      {/* Status card */}
      {linked && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'var(--card-bg)', border: '1px solid #3b82f6' }}
        >
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {linked.title}
            </p>
            {linkedAccount && (
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {linkedAccount.email}
              </p>
            )}
          </div>
          <button
            onClick={() => onChange('', '')}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#ef4444' }}
          >
            Unlink
          </button>
        </div>
      )}
    </div>
  )
}

export default function MealsSettings() {
  const accounts              = useSettingsStore((s) => s.accounts)
  const choresLists           = useSettingsStore((s) => s.choresLists)
  const mealsGoogleAccountId  = useSettingsStore((s) => s.mealsGoogleAccountId)
  const mealsGoogleTaskListId = useSettingsStore((s) => s.mealsGoogleTaskListId)
  const setMealsGoogleTaskList = useSettingsStore((s) => s.setMealsGoogleTaskList)
  const fridgeGoogleAccountId  = useSettingsStore((s) => s.fridgeGoogleAccountId)
  const fridgeGoogleTaskListId = useSettingsStore((s) => s.fridgeGoogleTaskListId)
  const setFridgeGoogleTaskList = useSettingsStore((s) => s.setFridgeGoogleTaskList)

  const accountIds = accounts.map((a) => a.id)
  const { data: googleTaskLists = [], isLoading } = useGoogleTaskLists(accountIds)

  // IDs reserved by Chores — cannot be double-selected
  const reservedByChores = new Set<string>(
    choresLists
      .filter((cl) => cl.googleAccountId && cl.googleTaskListId)
      .map((cl) => `${cl.googleAccountId}::${cl.googleTaskListId}`)
  )

  return (
    <div className="space-y-10 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Meals</h2>

      {/* ── Meals Tasks tab ── */}
      <TaskListSelector
        label="Meal planner — Tasks tab (optional)"
        description="Link a Google Tasks list to show a Tasks tab alongside the weekly meal grid — useful for a shared grocery or prep list."
        currentAccountId={mealsGoogleAccountId}
        currentTaskListId={mealsGoogleTaskListId}
        onChange={setMealsGoogleTaskList}
        accounts={accounts}
        googleTaskLists={googleTaskLists}
        isLoading={isLoading}
        reservedIds={reservedByChores}
      />

      {/* ── Fridge panels ── */}
      <TaskListSelector
        label="Fridge panels — Google Tasks list (optional)"
        description="Link a Google Tasks list to both fridge panels. When linked, both House Fridge and Garage Fridge show a shared checklist instead of free-text fields."
        currentAccountId={fridgeGoogleAccountId}
        currentTaskListId={fridgeGoogleTaskListId}
        onChange={setFridgeGoogleTaskList}
        accounts={accounts}
        googleTaskLists={googleTaskLists}
        isLoading={isLoading}
        reservedIds={reservedByChores}
      />
    </div>
  )
}
