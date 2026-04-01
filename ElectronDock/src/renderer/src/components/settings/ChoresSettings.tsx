import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import { useGoogleTaskLists } from '../../hooks/useGoogleTasks'
import type { ChoresList } from '../../../../preload/types'

export default function ChoresSettings() {
  const accounts       = useSettingsStore((s) => s.accounts)
  const choresLists    = useSettingsStore((s) => s.choresLists)
  const setChoresLists = useSettingsStore((s) => s.setChoresLists)
  const addList        = useSettingsStore((s) => s.addList)
  const removeList     = useSettingsStore((s) => s.removeList)

  const accountIds = accounts.map((a) => a.id)
  const { data: googleTaskLists = [] } = useGoogleTaskLists(accountIds)

  const [draftName, setDraftName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleAddList = async () => {
    const name = draftName.trim()
    if (!name) return
    const newAppList = await addList(name) as { id: string; name: string }
    const updated: ChoresList[] = [...choresLists, { id: newAppList.id, name }]
    setChoresLists(updated)
    setDraftName('')
  }

  const handleDelete = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    removeList(id)
    setChoresLists(choresLists.filter((l) => l.id !== id))
    setConfirmDeleteId(null)
  }

  const handleRename = (id: string) => {
    const name = editingName.trim()
    if (!name) { setEditingId(null); return }
    setChoresLists(choresLists.map((l) => l.id === id ? { ...l, name } : l))
    setEditingId(null)
  }

  const handleLinkGoogle = (id: string, value: string) => {
    if (!value) {
      setChoresLists(choresLists.map((l) =>
        l.id === id ? { ...l, googleTaskListId: undefined, googleAccountId: undefined } : l
      ))
      return
    }
    const [accountId, taskListId] = value.split('::')
    setChoresLists(choresLists.map((l) =>
      l.id === id ? { ...l, googleTaskListId: taskListId, googleAccountId: accountId } : l
    ))
  }

  const sectionStyle = { color: 'var(--text-primary)' }
  const labelStyle   = { color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-xl font-bold" style={sectionStyle}>Chores</h2>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Each chore list works offline by default. Optionally link any list to a Google Tasks list
        to sync tasks with Google — each list can be independently local or Google-backed.
      </p>

      {/* Chore lists */}
      <div className="space-y-3">
        <p style={labelStyle}>Chore lists</p>

        {choresLists.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No chore lists yet — add one below.
          </p>
        )}

        <div className="space-y-2">
          {choresLists.map((cl) => (
            <div
              key={cl.id}
              className="rounded-xl p-3 space-y-2"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="flex items-center gap-2">
                {/* Name (editable) */}
                {editingId === cl.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(cl.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(cl.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none min-h-[40px]"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                ) : (
                  <button
                    onClick={() => { setEditingId(cl.id); setEditingName(cl.name) }}
                    className="flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium min-h-[40px]
                               hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    title="Click to rename"
                  >
                    {cl.name}
                  </button>
                )}

                {/* Delete button */}
                {confirmDeleteId === cl.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs" style={{ color: '#f87171' }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(cl.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px]"
                      style={{ background: '#ef4444', color: '#fff' }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px]"
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDelete(cl.id)}
                    className="p-2 rounded-lg opacity-40 hover:opacity-100 transition-opacity flex-shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                    style={{ color: '#ef4444' }}
                    aria-label="Delete list"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Google Tasks link — always visible, each list independently local or Google */}
              <div className="flex items-center gap-2 pl-1">
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  Google Tasks:
                </span>
                {accounts.length === 0 ? (
                  <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                    No account connected
                  </span>
                ) : (
                  <select
                    value={
                      cl.googleAccountId && cl.googleTaskListId
                        ? `${cl.googleAccountId}::${cl.googleTaskListId}`
                        : ''
                    }
                    onChange={(e) => handleLinkGoogle(cl.id, e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg outline-none min-h-[40px]"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">— offline only —</option>
                    {googleTaskLists.map((tl) => {
                      const account = accounts.find((a) => a.id === tl.accountId)
                      return (
                        <option key={`${tl.accountId}::${tl.id}`} value={`${tl.accountId}::${tl.id}`}>
                          {tl.title}{account ? ` (${account.email})` : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new list */}
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddList()}
            placeholder="New chore list name…"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none min-h-[44px]"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleAddList}
            disabled={!draftName.trim()}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
