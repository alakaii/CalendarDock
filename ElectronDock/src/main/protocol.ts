import { net } from 'electron'
import { join, resolve, extname } from 'path'
import { readFile } from 'fs/promises'
import { settingsService } from './services/settings.service'
import { backgroundArtService } from './services/background-art.service'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif'
}

export async function photosProtocolHandler(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    // URL format: cdphoto://photo/filename.jpg (slideshow)
    //          or cdphoto://art/fullscreen.png (fullscreen background art)
    const filename = decodeURIComponent(url.pathname.replace(/^\//, ''))

    let baseFolder: string
    if (url.hostname === 'art') {
      baseFolder = backgroundArtService.dir()
    } else {
      const configuredFolder = settingsService.getAll().photoFolderPath
      if (!configuredFolder) {
        return new Response('No photo folder configured', { status: 404 })
      }
      baseFolder = configuredFolder
    }

    // Security: ensure resolved path is strictly within the base folder
    const fullPath = resolve(baseFolder, filename)
    if (!fullPath.startsWith(resolve(baseFolder))) {
      return new Response('Forbidden', { status: 403 })
    }

    const data = await readFile(fullPath)
    const ext = extname(filename).toLowerCase()
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream'

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (err) {
    return new Response('Not found', { status: 404 })
  }
}
