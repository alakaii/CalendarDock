import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settings.slice'
import type { WyzeCamera, RingCameraInfo } from '../../../../preload/types'

function WyzeTile({ camera }: { camera: WyzeCamera }) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    window.api.cameras?.startStream(camera.id)
      .then((url) => {
        if (active) { setStreamUrl(url); setLoading(false) }
      })
      .catch((err: Error) => {
        if (active) { setError(err.message); setLoading(false) }
      })

    return () => {
      active = false
      window.api.cameras?.stopStream(camera.id).catch(() => {})
    }
  }, [camera.id, camera.rtspUrl])

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex-shrink-0"
      style={{
        background: '#000',
        border: '1px solid var(--border)',
        aspectRatio: '16/9',
      }}
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
             style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-8 h-8 animate-spin opacity-50" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span className="text-sm">Connecting…</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
             style={{ color: '#f87171' }}>
          <svg className="w-8 h-8 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs">{error}</p>
          <p className="text-xs opacity-60">Check RTSP URL or ensure FFmpeg is installed</p>
        </div>
      )}

      {streamUrl && !error && (
        <img
          src={streamUrl}
          className="w-full h-full object-contain"
          style={{ display: loading ? 'none' : 'block' }}
          onLoad={() => setLoading(false)}
          onError={() => setError('Stream failed — check RTSP URL')}
        />
      )}

      {/* Camera name overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2"
           style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
        <p className="text-sm font-semibold text-white">{camera.name}</p>
      </div>
    </div>
  )
}

function RingTile({ camera, intervalSec }: { camera: RingCameraInfo; intervalSec: number }) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [bust, setBust]               = useState(() => Date.now())
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    let active = true
    window.api.ring?.snapshotUrl(camera.id)
      .then((url) => { if (active) setSnapshotUrl(url) })
      .catch((err: Error) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [camera.id])

  useEffect(() => {
    if (!snapshotUrl) return
    const ms = Math.max(5, intervalSec) * 1000
    const handle = setInterval(() => setBust(Date.now()), ms)
    return () => clearInterval(handle)
  }, [snapshotUrl, intervalSec])

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex-shrink-0"
      style={{
        background: '#000',
        border: '1px solid var(--border)',
        aspectRatio: '16/9',
      }}
    >
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-8 h-8 animate-spin opacity-50" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
             style={{ color: '#f87171' }}>
          <p className="text-xs">{error}</p>
        </div>
      )}

      {snapshotUrl && !error && (
        <img
          src={`${snapshotUrl}?t=${bust}`}
          className="w-full h-full object-contain"
          onLoad={() => setLoading(false)}
          onError={() => { setError('Snapshot failed'); setLoading(false) }}
        />
      )}

      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
           style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
        <p className="text-sm font-semibold text-white">{camera.name}</p>
        <span className="text-xs text-white opacity-70">Ring</span>
      </div>
    </div>
  )
}

export default function CamerasPage() {
  const wyzeCameras = useSettingsStore((s) => s.cameras)
  const intervalSec = useSettingsStore((s) => s.ringSnapshotIntervalSec)

  const [ringCameras, setRingCameras] = useState<RingCameraInfo[]>([])

  useEffect(() => {
    let active = true
    window.api.ring?.listCameras()
      .then((list) => { if (active) setRingCameras(list ?? []) })
      .catch(() => { if (active) setRingCameras([]) })
    return () => { active = false }
  }, [])

  // Stop all Wyze streams when leaving the page
  useEffect(() => {
    return () => {
      window.api.cameras?.stopAllStreams().catch(() => {})
    }
  }, [])

  const total = wyzeCameras.length + ringCameras.length

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8"
           style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
        <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
        <div className="text-center space-y-1">
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No cameras configured</p>
          <p className="text-sm">Add Wyze cameras under Settings → Cameras, or connect Ring under Settings → Ring.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--bg-base)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {wyzeCameras.map((camera) => (
          <WyzeTile key={`wyze-${camera.id}`} camera={camera} />
        ))}
        {ringCameras.map((camera) => (
          <RingTile key={`ring-${camera.id}`} camera={camera} intervalSec={intervalSec} />
        ))}
      </div>
    </div>
  )
}
