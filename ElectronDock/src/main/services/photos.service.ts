import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { extname, basename } from 'path'

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'])

let watcher: FSWatcher | null = null
let photoList: string[] = []

export const photosService = {
  startWatcher(folderPath: string, win: BrowserWindow): void {
    if (watcher) {
      watcher.close()
    }

    photoList = []

    watcher = chokidar.watch(folderPath, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 }
    })

    watcher
      .on('add', (filePath) => {
        if (isSupportedPhoto(filePath)) {
          const name = basename(filePath)
          if (!photoList.includes(name)) {
            photoList.push(name)
            win.webContents.send('photos:list-updated', [...photoList])
          }
        }
      })
      .on('unlink', (filePath) => {
        const name = basename(filePath)
        photoList = photoList.filter((f) => f !== name)
        win.webContents.send('photos:list-updated', [...photoList])
      })
      .on('error', (err) => console.error('Photo watcher error:', err))
  },

  stopWatcher(): void {
    if (watcher) {
      watcher.close()
      watcher = null
    }
  },

  getList(): string[] {
    return [...photoList]
  },

  /**
   * Replace the photo list in one shot and notify the renderer.
   * Used by photoQueueService after bulk disk operations so correctness
   * doesn't depend on the chokidar watcher emitting every change.
   */
  setList(filenames: string[], win: BrowserWindow): void {
    photoList = [...filenames]
    win.webContents.send('photos:list-updated', [...photoList])
  },

  restartWatcher(folderPath: string, win: BrowserWindow): void {
    this.startWatcher(folderPath, win)
  }
}

function isSupportedPhoto(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}
