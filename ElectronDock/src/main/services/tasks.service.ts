import { google } from 'googleapis'
import { authService } from './auth.service'

export interface GTaskList {
  id: string
  title: string
  accountId: string
}

export interface GTask {
  id: string
  taskListId: string
  accountId: string
  title: string
  notes?: string
  status: 'needsAction' | 'completed'
  due?: string         // RFC 3339 date-only, e.g. "2026-03-07T00:00:00.000Z"
  completed?: string   // RFC 3339 when completed
  updated: string
  parent?: string      // parent task id (for subtasks)
  position?: string
}

export const tasksService = {
  /** List all task lists for an account */
  async listTaskLists(accountId: string): Promise<GTaskList[]> {
    const client = authService.getClient(accountId)
    if (!client) throw new Error(`No OAuth client for account ${accountId}`)

    const api = google.tasks({ version: 'v1', auth: client })
    const { data } = await api.tasklists.list({ maxResults: 100 })

    return (data.items ?? []).map((l) => ({
      id: l.id ?? '',
      title: l.title ?? 'Untitled',
      accountId
    }))
  },

  /** List tasks in a task list */
  async listTasks(
    accountId: string,
    taskListId: string,
    showCompleted = true
  ): Promise<GTask[]> {
    const client = authService.getClient(accountId)
    if (!client) throw new Error(`No OAuth client for account ${accountId}`)

    const api = google.tasks({ version: 'v1', auth: client })
    const { data } = await api.tasks.list({
      tasklist: taskListId,
      maxResults: 200,
      showCompleted,
      showHidden: false
    })

    return (data.items ?? []).map((t) => ({
      id: t.id ?? '',
      taskListId,
      accountId,
      title: t.title ?? '',
      notes: t.notes ?? undefined,
      status: (t.status ?? 'needsAction') as 'needsAction' | 'completed',
      due: t.due ?? undefined,
      completed: t.completed ?? undefined,
      updated: t.updated ?? new Date().toISOString(),
      parent: t.parent ?? undefined,
      position: t.position ?? undefined
    }))
  },

  /** Create a new task */
  async createTask(
    accountId: string,
    taskListId: string,
    title: string,
    notes?: string,
    due?: string
  ): Promise<GTask> {
    const client = authService.getClient(accountId)
    if (!client) throw new Error(`No OAuth client for account ${accountId}`)

    const api = google.tasks({ version: 'v1', auth: client })
    const { data } = await api.tasks.insert({
      tasklist: taskListId,
      requestBody: { title, notes, due }
    })

    return {
      id: data.id ?? '',
      taskListId,
      accountId,
      title: data.title ?? '',
      notes: data.notes ?? undefined,
      status: (data.status ?? 'needsAction') as 'needsAction' | 'completed',
      due: data.due ?? undefined,
      completed: data.completed ?? undefined,
      updated: data.updated ?? new Date().toISOString()
    }
  },

  /** Toggle task completion */
  async setTaskComplete(
    accountId: string,
    taskListId: string,
    taskId: string,
    complete: boolean
  ): Promise<GTask> {
    const client = authService.getClient(accountId)
    if (!client) throw new Error(`No OAuth client for account ${accountId}`)

    const api = google.tasks({ version: 'v1', auth: client })
    const { data } = await api.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: {
        status: complete ? 'completed' : 'needsAction',
        completed: complete ? new Date().toISOString() : undefined
      }
    })

    return {
      id: data.id ?? '',
      taskListId,
      accountId,
      title: data.title ?? '',
      notes: data.notes ?? undefined,
      status: (data.status ?? 'needsAction') as 'needsAction' | 'completed',
      due: data.due ?? undefined,
      completed: data.completed ?? undefined,
      updated: data.updated ?? new Date().toISOString()
    }
  },

  /** Update task title / notes */
  async updateTask(
    accountId: string,
    taskListId: string,
    taskId: string,
    patch: { title?: string; notes?: string; due?: string }
  ): Promise<GTask> {
    const client = authService.getClient(accountId)
    if (!client) throw new Error(`No OAuth client for account ${accountId}`)

    const api = google.tasks({ version: 'v1', auth: client })
    const { data } = await api.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: patch
    })

    return {
      id: data.id ?? '',
      taskListId,
      accountId,
      title: data.title ?? '',
      notes: data.notes ?? undefined,
      status: (data.status ?? 'needsAction') as 'needsAction' | 'completed',
      due: data.due ?? undefined,
      completed: data.completed ?? undefined,
      updated: data.updated ?? new Date().toISOString()
    }
  },

  /** Delete a task */
  async deleteTask(accountId: string, taskListId: string, taskId: string): Promise<void> {
    const client = authService.getClient(accountId)
    if (!client) throw new Error(`No OAuth client for account ${accountId}`)

    const api = google.tasks({ version: 'v1', auth: client })
    await api.tasks.delete({ tasklist: taskListId, task: taskId })
  }
}
