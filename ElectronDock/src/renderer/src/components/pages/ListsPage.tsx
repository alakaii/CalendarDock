import { useState } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import {
  useGoogleTaskLists,
  useGoogleTasks,
  useCreateTask,
  useSetTaskComplete,
  useDeleteTask
} from '../../hooks/useGoogleTasks'
import type { GTaskList } from '../../../../preload/types'

// ---------- Single task row ----------
function TaskRow({
  title,
  done,
  onToggle,
  onDelete
}: {
  title: string
  done: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl min-h-[56px] ${done ? 'opacity-50' : ''}`}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={onToggle}
        className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
        style={done
          ? { background: '#22c55e', borderColor: '#22c55e' }
          : { borderColor: 'var(--text-secondary)' }
        }
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
      >
        {done && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span
        className={`flex-1 text-base ${done ? 'line-through' : ''}`}
        style={{ color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}
      >
        {title}
      </span>
      <button
        onClick={onDelete}
        className="p-1.5 rounded-lg opacity-30 hover:opacity-100 transition-opacity"
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

// ---------- Main page ----------
export default function ListsPage() {
  const accounts   = useSettingsStore((s) => s.accounts)
  const accountIds = accounts.map((a) => a.id)

  const { data: taskLists = [], isLoading: listsLoading } = useGoogleTaskLists(accountIds)

  const [selected, setSelected] = useState<GTaskList | null>(null)
  const activeList = selected ?? taskLists[0] ?? null

  const { data: tasks = [], isLoading: tasksLoading } = useGoogleTasks(
    activeList ? { accountId: activeList.accountId, taskListId: activeList.id, showCompleted: true } : null
  )

  const createTask  = useCreateTask()
  const setComplete = useSetTaskComplete()
  const removeTask  = useDeleteTask()
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    if (!draft.trim() || !activeList) return
    createTask.mutate({ accountId: activeList.accountId, taskListId: activeList.id, title: draft.trim() })
    setDraft('')
  }

  // ---- No accounts ----
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3"
           style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
        <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p className="text-sm">Connect a Google account in Settings to see your Tasks</p>
      </div>
    )
  }

  const active = tasks.filter((t) => t.status !== 'completed')
  const done   = tasks.filter((t) => t.status === 'completed')

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* Left: task list selector */}
      <div
        className="w-52 flex flex-col flex-shrink-0 overflow-y-auto py-2"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        {listsLoading ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : taskLists.length === 0 ? (
          <p className="text-xs text-center py-8 px-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            No task lists found — create one in Google Tasks on your phone first
          </p>
        ) : (
          taskLists.map((list) => {
            const account = accounts.find((a) => a.id === list.accountId)
            const isActive = activeList?.id === list.id && activeList?.accountId === list.accountId
            return (
              <button
                key={`${list.accountId}-${list.id}`}
                onClick={() => setSelected(list)}
                className="flex flex-col items-start gap-0.5 px-4 py-3 text-sm font-medium
                           min-h-[52px] transition-colors text-left"
                style={{
                  background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: isActive ? '#3b82f6' : 'var(--text-primary)',
                }}
              >
                <span className="truncate w-full">{list.title}</span>
                {account && (
                  <span className="text-[10px] truncate w-full" style={{ color: 'var(--text-secondary)' }}>
                    {account.email}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Right: task list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">

          {tasksLoading && (
            <p className="text-sm text-center py-12" style={{ color: 'var(--text-secondary)' }}>Loading tasks…</p>
          )}

          {!tasksLoading && active.length === 0 && done.length === 0 && (
            <p className="text-sm text-center py-16" style={{ color: 'var(--text-secondary)' }}>
              No tasks — add one below!
            </p>
          )}

          {active.map((t) => (
            <TaskRow
              key={t.id}
              title={t.title}
              done={false}
              onToggle={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: true })}
              onDelete={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
            />
          ))}

          {done.length > 0 && (
            <>
              <p className="text-xs font-semibold mt-5 mb-1.5 px-1" style={{ color: 'var(--text-secondary)' }}>
                COMPLETED ({done.length})
              </p>
              {done.map((t) => (
                <TaskRow
                  key={t.id}
                  title={t.title}
                  done={true}
                  onToggle={() => setComplete.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id, complete: false })}
                  onDelete={() => removeTask.mutate({ accountId: t.accountId, taskListId: t.taskListId, taskId: t.id })}
                />
              ))}
            </>
          )}
        </div>

        {/* Add task */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={activeList ? `Add to ${activeList.title}…` : 'Select a list'}
            disabled={!activeList}
            className="flex-1 bg-transparent text-base outline-none placeholder:opacity-40 disabled:opacity-30"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleAdd}
            disabled={!draft.trim() || !activeList || createTask.isPending}
            className="px-4 py-2 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-30 min-h-[44px]"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
