import { createServer, IncomingMessage, ServerResponse } from 'http'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'

const STREAM_PORT = 54321

interface StreamEntry {
  process: ChildProcessWithoutNullStreams
  clients: Set<ServerResponse>
  buffer: Buffer
}

const streams = new Map<string, StreamEntry>()

// Single HTTP server that routes all MJPEG streams by camera ID
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const cameraId = req.url?.replace('/stream/', '')
  if (!cameraId || !streams.has(cameraId)) {
    res.writeHead(404)
    res.end()
    return
  }

  const entry = streams.get(cameraId)!

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace;boundary=ffserver',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  entry.clients.add(res)

  req.on('close', () => {
    entry.clients.delete(res)
  })
})

server.listen(STREAM_PORT)

export const camerasService = {
  startStream(cameraId: string, rtspUrl: string): string {
    if (streams.has(cameraId)) {
      return `http://localhost:${STREAM_PORT}/stream/${cameraId}`
    }

    const ffmpegArgs = [
      '-loglevel', 'quiet',
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-f', 'mpjpeg',
      '-q:v', '5',
      '-r', '10',
      'pipe:1',
    ]

    const proc = spawn('ffmpeg', ffmpegArgs)

    const entry: StreamEntry = {
      process: proc,
      clients: new Set(),
      buffer: Buffer.alloc(0),
    }

    proc.stdout.on('data', (chunk: Buffer) => {
      for (const client of entry.clients) {
        try {
          client.write(chunk)
        } catch {
          entry.clients.delete(client)
        }
      }
    })

    proc.on('exit', () => {
      streams.delete(cameraId)
    })

    streams.set(cameraId, entry)
    return `http://localhost:${STREAM_PORT}/stream/${cameraId}`
  },

  stopStream(cameraId: string): void {
    const entry = streams.get(cameraId)
    if (!entry) return
    for (const client of entry.clients) {
      try { client.end() } catch { /* ignore */ }
    }
    entry.process.kill('SIGTERM')
    streams.delete(cameraId)
  },

  stopAllStreams(): void {
    for (const cameraId of streams.keys()) {
      this.stopStream(cameraId)
    }
  }
}
