import { useSettingsStore } from '../../store/settings.slice'
import { useGoogleTaskLists } from '../../hooks/useGoogleTasks'

export default function ListsSettings() {
  const accounts           = useSettingsStore((s) => s.accounts)
  const listsMode          = useSettingsStore((s) => s.listsMode)
  const listsFilter        = useSettingsStore((s) => s.listsFilter)
  const listsSelectedIds   = useSettingsStore((s) => s.listsSelectedIds)
  const setListsMode       = useSettingsStore((s) => s.setListsMode)
  const setListsFilter     = useSettingsStore((s) => s.setListsFilter)
  const setListsSelectedIds = useSettingsStore((s) => s.setListsSelectedIds)

  const accountIds = accounts.map((a) => a.id)
  const { data: googleTaskLists = [], isLoading } = useGoogleTaskLists(accountIds)

  const toggleSelected = (key: string) => {
    if (listsSelectedIds.includes(key)) {
      setListsSelectedIds(listsSelectedIds.filter((id) => id !== key))
    } else {
      setListsSelectedIds([...listsSelectedIds, key])
    }
  }

  const labelStyle = { color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Lists</h2>

      {/* Mode toggle */}
      <div className="space-y-2">
        <p style={labelStyle}>Data source</p>
        <div className="flex gap-2">
          {(['local', 'google'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setListsMode(m)}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px]"
              style={{
                background: listsMode === m ? '#3b82f6' : 'var(--card-bg)',
                border: `1px solid ${listsMode === m ? '#3b82f6' : 'var(--card-border)'}`,
                color: listsMode === m ? '#fff' : 'var(--text-primary)',
              }}
            >
              {m === 'local' ? 'Local (offline)' : 'Google Tasks'}
            </button>
          ))}
        </div>
        {listsMode === 'google' && accounts.length === 0 && (
          <p className="text-sm mt-1" style={{ color: '#f59e0b' }}>
            No Google accounts connected — add one in Accounts settings.
          </p>
        )}
      </div>

      {/* Google Tasks options */}
      {listsMode === 'google' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p style={labelStyle}>Which lists to show</p>
            <div className="flex gap-2">
              {(['all', 'selected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setListsFilter(f)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors min-h-[44px]"
                  style={{
                    background: listsFilter === f ? '#3b82f6' : 'var(--card-bg)',
                    border: `1px solid ${listsFilter === f ? '#3b82f6' : 'var(--card-border)'}`,
                    color: listsFilter === f ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {f === 'all' ? 'All lists' : 'Choose lists'}
                </button>
              ))}
            </div>
          </div>

          {listsFilter === 'selected' && (
            <div className="space-y-2">
              <p style={labelStyle}>Visible lists</p>
              {isLoading && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
              )}
              {!isLoading && googleTaskLists.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No task lists found. Make sure a Google account is connected.
                </p>
              )}
              <div className="space-y-1.5">
                {googleTaskLists.map((tl) => {
                  const key = `${tl.accountId}::${tl.id}`
                  const account = accounts.find((a) => a.id === tl.accountId)
                  const checked = listsSelectedIds.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSelected(key)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors min-h-[52px]"
                      style={{
                        background: 'var(--card-bg)',
                        border: `1px solid ${checked ? '#3b82f6' : 'var(--card-border)'}`,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: checked ? '#3b82f6' : 'var(--input-bg)',
                          border: `2px solid ${checked ? '#3b82f6' : 'var(--input-border)'}`,
                        }}
                      >
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {tl.title}
                        </p>
                        {account && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            {account.email}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
