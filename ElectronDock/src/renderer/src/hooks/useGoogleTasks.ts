import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { GTask } from '../../../preload/types'

export interface TasksFilter {
  accountId: string
  taskListId: string
  showCompleted?: boolean
}

export function useGoogleTaskLists(accountIds: string[]) {
  return useQuery({
    queryKey: ['task-lists', accountIds],
    queryFn: async () => {
      if (accountIds.length === 0) return []
      const results = await Promise.allSettled(
        accountIds.map((id) => window.api.tasks.listTaskLists(id))
      )
      return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    },
    staleTime: 10 * 60 * 1000, // 10 min
    enabled: accountIds.length > 0
  })
}

export function useGoogleTasks(filter: TasksFilter | null) {
  return useQuery({
    queryKey: ['tasks', filter?.accountId, filter?.taskListId, filter?.showCompleted],
    queryFn: () => {
      if (!filter) return []
      return window.api.tasks.listTasks(
        filter.accountId,
        filter.taskListId,
        filter.showCompleted ?? true
      )
    },
    staleTime: 2 * 60 * 1000, // 2 min
    refetchInterval: 5 * 60 * 1000, // 5 min
    enabled: !!filter
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      taskListId,
      title,
      notes,
      due
    }: {
      accountId: string
      taskListId: string
      title: string
      notes?: string
      due?: string
    }) => window.api.tasks.createTask(accountId, taskListId, title, notes, due),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', vars.accountId, vars.taskListId] })
    }
  })
}

export function useSetTaskComplete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      taskListId,
      taskId,
      complete
    }: {
      accountId: string
      taskListId: string
      taskId: string
      complete: boolean
    }) => window.api.tasks.setComplete(accountId, taskListId, taskId, complete),
    onMutate: async ({ accountId, taskListId, taskId, complete }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['tasks', accountId, taskListId] })
      const prev = qc.getQueryData<GTask[]>(['tasks', accountId, taskListId])
      qc.setQueryData<GTask[]>(['tasks', accountId, taskListId], (old) =>
        (old ?? []).map((t) =>
          t.id === taskId
            ? { ...t, status: complete ? 'completed' : 'needsAction' }
            : t
        )
      )
      return { prev }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['tasks', vars.accountId, vars.taskListId], ctx.prev)
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', vars.accountId, vars.taskListId] })
    }
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      taskListId,
      taskId
    }: {
      accountId: string
      taskListId: string
      taskId: string
    }) => window.api.tasks.deleteTask(accountId, taskListId, taskId),
    onMutate: async ({ accountId, taskListId, taskId }) => {
      await qc.cancelQueries({ queryKey: ['tasks', accountId, taskListId] })
      const prev = qc.getQueryData<GTask[]>(['tasks', accountId, taskListId])
      qc.setQueryData<GTask[]>(['tasks', accountId, taskListId], (old) =>
        (old ?? []).filter((t) => t.id !== taskId)
      )
      return { prev }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['tasks', vars.accountId, vars.taskListId], ctx.prev)
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', vars.accountId, vars.taskListId] })
    }
  })
}
