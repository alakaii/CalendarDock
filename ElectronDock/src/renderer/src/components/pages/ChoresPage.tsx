import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import {
  useGoogleTasks,
  useCreateTask,
  useSetTaskComplete,
  useDeleteTask
} from '../../hooks/useGoogleTasks'
import type { ChoresList } from '../../../../preload/types'

// ── Shared checklist item row ─────────────────────────────────────────────────

function ItemRow({
  label,
  checked,
  onToggle,
  onDelete,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl min-h-[56px] ${checked ? 'opacity-50' : ''}`}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={onToggle}
        className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
        style={checked
          ? { background: '#22c55e', borderColor: '#22c55e' }
          : { borderColor: 'var(--text-secondary)' }
        }
        aria-label={checked ? 'Unmark done' : 'Mark done'}
      >
        {checked && (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span
        className={`flex-1 text-base ${checked ? 'line-through' : ''}`}
        style={{ color: checked ? 'var(--text-secondary)' : 'var(--text-primary)' }}
      >
        {label}
      </span>
      <button
        onClick={onDelete}
        className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Delete"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Local chore list ──────────────────────────────────────────────────────────

function LocalChoreList({ choresList }: { choresList: ChoresList }) {
  const lists      = useSettingsStore((s) => s.lists)
  const addItem    = useSettingsStore((s) => s.addItem)
  const toggleItem = useSettingsStore((s) => s.toggleItem)
  const removeItem = useSettingsStore((s) => s.removeItem)
  const [draft, setDraft] = useState('')

  const list  = lists.find((l) => l.id === choresList.id)
  const items = list?.items ?? []
  const unchecked = items.filter((it) => !it.checked)
  const checked   = items.filter((it) => it.checked)

  const handleAdd = async () => {
    const text = draft.trim()
    if (!text) return
    await addItem(choresList.id, text)
    setDraft('')
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {unchecked.length === 0 && checked.length === 0 && (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nothing here yet — add something below!
          </p>
        )}
        {unchecked.map((item) => (
          <ItemRow
            key={item.id}
            label={item.text}
            checked={false}
            onToggle={() => toggleItem(choresList.id, item.id, true)}
            onDelete={() => removeItem(choresList.id, item.id)}
          />
        ))}
        {checked.length > 0 && (
          <>
            <p className="text-xs font-semibold mt-4 mb-1 px-1" style={{ color: 'var(--text-secondary)' }}>
              COMPLETED ({checked.length})
            </p>
            {checked.map((item) => (
              <ItemRow
                key={item.id}
                label={item.text}
                checked={true}
                onToggle={() => toggleItem(choresList.id, item.id, false)}
                onDelete={() => removeItem(choresList.id, item.id)}
              />
            ))}
          </>
        )}
      </div>
      <div
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`Add to ${choresList.name}…`}
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

// ── Google chore list ─────────────────────────────────────────────────────────

function GoogleChoreList({ choresList }: { choresList: ChoresList }) {
  const { googleAccountId, googleTaskListId } = choresList

  const filter = googleAccountId && googleTaskListId
    ? { accountId: googleAccountId, taskListId: googleTaskListId, showCompleted: true }
    : null

  const { data: tasks = [], isLoading } = useGoogleTasks(filter)
  const createTask  = useCreateTask()
  const setComplete = useSetTaskComplete()
  const removeTask  = useDeleteTask()
  const [draft, setDraft] = useState('')

  if (!googleAccountId || !googleTaskListId) {
    return (
      <div className="flex items-center justify-center h-full px-8">
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          No Google Tasks list linked to "{choresList.name}". Go to Settings → Chores to link one.
        </p>
      </div>
    )
  }

  const handleAdd = () => {
    const title = draft.trim()
    if (!title || !googleAccountId || !googleTaskListId) return
    createTask.mutate({ accountId: googleAccountId, taskListId: googleTaskListId, title })
    setDraft('')
  }

  const active = tasks.filter((t) => t.status !== 'completed')
  const done   = tasks.filter((t) => t.status === 'completed')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {isLoading && (
          <p className="text-sm text-center py-12" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        )}
        {!isLoading && active.length === 0 && done.length === 0 && (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nothing here yet — add something below!
          </p>
        )}
        {active.map((t) => (
          <ItemRow
            key={t.id}
            label={t.title}
            checked={false}
            onToggle={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: true })}
            onDelete={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
          />
        ))}
        {done.length > 0 && (
          <>
            <p className="text-xs font-semibold mt-4 mb-1 px-1" style={{ color: 'var(--text-secondary)' }}>
              COMPLETED ({done.length})
            </p>
            {done.map((t) => (
              <ItemRow
                key={t.id}
                label={t.title}
                checked={true}
                onToggle={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: false })}
                onDelete={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
              />
            ))}
          </>
        )}
      </div>
      <div
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`Add to ${choresList.name}…`}
          className="flex-1 bg-transparent text-base outline-none placeholder:opacity-40"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim() || createTask.isPending}
          className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChoresPage() {
  const choresMode  = useSettingsStore((s) => s.choresMode)
  const choresLists = useSettingsStore((s) => s.choresLists)

  const [activeTab, setActiveTab] = useState(0)
  const activeIdx = Math.min(activeTab, choresLists.length - 1)
  const activeList = choresLists[activeIdx] ?? null

  if (choresLists.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-8"
           style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          No chore lists configured. Go to Settings → Chores to add one.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* Tabs — only show if more than one list */}
      {choresLists.length > 1 && (
        <div
          className="flex flex-shrink-0 gap-1 px-4 pt-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {choresLists.map((cl, i) => (
            <button
              key={cl.id}
              onClick={() => setActiveTab(i)}
              className="px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-colors min-h-[44px]"
              style={{
                background: activeIdx === i ? 'var(--bg-surface)' : 'transparent',
                color: activeIdx === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeIdx === i ? '2px solid #3b82f6' : '2px solid transparent',
              }}
            >
              {cl.name}
            </button>
          ))}
        </div>
      )}

      {/* List content */}
      <div className="flex-1 overflow-hidden">
        {activeList && (
          choresMode === 'local'
            ? <LocalChoreList choresList={activeList} />
            : <GoogleChoreList choresList={activeList} />
        )}
      </div>
    </div>
  )
}
