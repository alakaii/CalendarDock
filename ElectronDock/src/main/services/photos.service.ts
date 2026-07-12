import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { extname, basename } from 'path'

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'])

let watcher: FSWatcher | null = null
// The slideshow pool is the union of two independent sources:
//   mainList   — the watched primary folder (local folder or the Dropbox cache)
//   icloudList — the iCloud Shared Album cache (set by icloudService)
// The renderer always receives the merged list so photos mix automatically.
let mainList: string[]   = []
let icloudList: string[] = []
let currentWin: BrowserWindow | null = null

function union(): string[] {
  return [...mainList, ...icloudList]
}

function emit(): void {
  currentWin?.webContents.send('photos:list-updated', union())
}

export const photosService = {
  startWatcher(folderPath: string, win: BrowserWindow): void {
    if (watcher) {
      watcher.close()
    }

    currentWin = win
    mainList = []

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
          if (!mainList.includes(name)) {
            mainList.push(name)
            emit()
          }
        }
      })
      .on('unlink', (filePath) => {
        const name = basename(filePath)
        mainList = mainList.filter((f) => f !== name)
        emit()
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
    return union()
  },

  /**
   * Replace the primary (watched-folder) list in one shot and notify the
   * renderer. Used by photoQueueService after bulk disk operations so
   * correctness doesn't depend on the chokidar watcher emitting every change.
   */
  setList(filenames: string[], win: BrowserWindow): void {
    currentWin = win
    mainList = [...filenames]
    emit()
  },

  /**
   * Replace the iCloud Shared Album sub-list and notify the renderer. The
   * iCloud cache lives in its own folder (userData/icloud-cache) outside the
   * watched primary folder, so it's supplied explicitly by icloudService.
   */
  setIcloudList(filenames: string[], win: BrowserWindow): void {
    currentWin = win
    icloudList = [...filenames]
    emit()
  },

  restartWatcher(folderPath: string, win: BrowserWindow): void {
    this.startWatcher(folderPath, win)
  }
}

function isSupportedPhoto(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}
