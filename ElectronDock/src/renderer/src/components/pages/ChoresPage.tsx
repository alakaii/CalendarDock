import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'

interface ChoresPageProps {
  listId?: string   // defaults to 'chores'
  title?: string
}

export default function ChoresPage({ listId = 'chores', title = 'Chores' }: ChoresPageProps) {
  const lists      = useSettingsStore((s) => s.lists)
  const addItem    = useSettingsStore((s) => s.addItem)
  const toggleItem = useSettingsStore((s) => s.toggleItem)
  const removeItem = useSettingsStore((s) => s.removeItem)

  const [draft, setDraft] = useState('')

  const list = lists.find((l) => l.id === listId)
  const items = list?.items ?? []

  const handleAdd = async () => {
    const text = draft.trim()
    if (!text) return
    await addItem(listId, text)
    setDraft('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const unchecked = items.filter((it) => !it.checked)
  const checked   = items.filter((it) => it.checked)

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">

        {unchecked.length === 0 && checked.length === 0 && (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nothing here yet — add something below!
          </p>
        )}

        {/* Active items */}
        {unchecked.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl min-h-[56px]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={() => toggleItem(listId, item.id, true)}
              className="w-6 h-6 rounded-full border-2 flex-shrink-0 transition-colors"
              style={{ borderColor: 'var(--text-secondary)' }}
              aria-label="Mark done"
            />
            <span className="flex-1 text-base" style={{ color: 'var(--text-primary)' }}>
              {item.text}
            </span>
            <button
              onClick={() => removeItem(listId, item.id)}
              className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Completed items */}
        {checked.length > 0 && (
          <>
            <p className="text-xs font-semibold mt-4 mb-1 px-1" style={{ color: 'var(--text-secondary)' }}>
              COMPLETED ({checked.length})
            </p>
            {checked.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl min-h-[56px] opacity-50"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <button
                  onClick={() => toggleItem(listId, item.id, false)}
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
                  style={{ background: '#22c55e', borderColor: '#22c55e' }}
                  aria-label="Unmark done"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <span className="flex-1 text-base line-through" style={{ color: 'var(--text-secondary)' }}>
                  {item.text}
                </span>
                <button
                  onClick={() => removeItem(listId, item.id)}
                  className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Add item input */}
      <div
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Add to ${list?.name ?? title}…`}
          className="flex-1 bg-transparent text-base outline-none placeholder:opacity-40"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}
