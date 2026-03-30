import { ipcMain } from 'electron'
import { tasksService } from '../services/tasks.service'

export function registerTasksHandlers(): void {
  ipcMain.handle(
    'tasks:list-task-lists',
    async (_event, { accountId }: { accountId: string }) => {
      return tasksService.listTaskLists(accountId)
    }
  )

  ipcMain.handle(
    'tasks:list-tasks',
    async (
      _event,
      {
        accountId,
        taskListId,
        showCompleted
      }: { accountId: string; taskListId: string; showCompleted?: boolean }
    ) => {
      return tasksService.listTasks(accountId, taskListId, showCompleted ?? true)
    }
  )

  ipcMain.handle(
    'tasks:create-task',
    async (
      _event,
      {
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
      }
    ) => {
      return tasksService.createTask(accountId, taskListId, title, notes, due)
    }
  )

  ipcMain.handle(
    'tasks:set-complete',
    async (
      _event,
      {
        accountId,
        taskListId,
        taskId,
        complete
      }: { accountId: string; taskListId: string; taskId: string; complete: boolean }
    ) => {
      return tasksService.setTaskComplete(accountId, taskListId, taskId, complete)
    }
  )

  ipcMain.handle(
    'tasks:update-task',
    async (
      _event,
      {
        accountId,
        taskListId,
        taskId,
        patch
      }: {
        accountId: string
        taskListId: string
        taskId: string
        patch: { title?: string; notes?: string; due?: string }
      }
    ) => {
      return tasksService.updateTask(accountId, taskListId, taskId, patch)
    }
  )

  ipcMain.handle(
    'tasks:delete-task',
    async (
      _event,
      {
        accountId,
        taskListId,
        taskId
      }: { accountId: string; taskListId: string; taskId: string }
    ) => {
      return tasksService.deleteTask(accountId, taskListId, taskId)
    }
  )
}
