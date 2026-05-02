import { useEffect, useState } from 'react'
import type { UpdateCheckResult, UpdateProgress, UpdateSchedule } from '../../../../preload/types'

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'checked'; result: UpdateCheckResult }
  | { kind: 'progress'; progress: UpdateProgress }
  | { kind: 'error'; message: string }

const blue = '#3b82f6'

export default function UpdatesSettings() {
  const [status, setStatus]     = useState<Status>({ kind: 'idle' })
  const [schedule, setSchedule] = useState<UpdateSchedule | null>(null)

  useEffect(() => {
    window.api.updates.getSchedule().then(setSchedule).catch(() => { /* ignore */ })
    window.api.updates.onProgress((p) => {
      setStatus({ kind: 'progress', progress: p })
    })
    // Auto-check once on open
    void runCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runCheck = async () => {
    setStatus({ kind: 'checking' })
    try {
      const result = await window.api.updates.check()
      setStatus({ kind: 'checked', result })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const runInstall = async () => {
    try {
      await window.api.updates.install()
      // The kiosk will restart shortly via systemd; UI may not update further.
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const updateSchedule = async (next: UpdateSchedule) => {
    const saved = await window.api.updates.setSchedule(next)
    setSchedule(saved)
  }

  const checked = status.kind === 'checked' ? status.result : null
  const progress = status.kind === 'progress' ? status.progress : null
  const errorMessage = status.kind === 'error' ? status.message : null

  return (
    <div className="space-y-8 max-w-lg">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Updates</h2>

      {/* Current version */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Installed Version
        </label>
        <div
          className="px-3 py-2 rounded-lg text-sm font-mono"
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {checked?.currentVersion ?? '—'}
        </div>
      </section>

      {/* Check / install */}
      <section className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Check for Updates
        </label>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Pulls the latest release from GitHub and installs it. The app will restart.
        </p>

        <div className="flex gap-3 mt-2">
          <button
            onClick={runCheck}
            disabled={status.kind === 'checking' || status.kind === 'progress'}
            className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-50"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {status.kind === 'checking' ? 'Checking…' : 'Check Now'}
          </button>

          {checked?.hasUpdate && status.kind !== 'progress' && (
            <button
              onClick={runInstall}
              className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]"
              style={{ background: blue, color: '#fff' }}
            >
              Install {checked.latestVersion}
            </button>
          )}
        </div>

        {/* Status line */}
        <div className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {checked && checked.unavailableReason && (
            <span>{checked.unavailableReason}</span>
          )}
          {checked && !checked.unavailableReason && !checked.hasUpdate && (
            <span style={{ color: '#10b981' }}>✓ Up to date</span>
          )}
          {checked && !checked.unavailableReason && checked.hasUpdate && (
            <span style={{ color: blue }}>
              Update available: <strong>{checked.latestVersion}</strong>
            </span>
          )}
          {progress?.phase === 'downloading' && (
            <span>Downloading… {progress.percent}%</span>
          )}
          {progress?.phase === 'installing' && (
            <span>Installing…</span>
          )}
          {progress?.phase === 'restarting' && (
            <span>Restarting CalendarDock…</span>
          )}
          {(progress?.phase === 'error' || errorMessage) && (
            <span style={{ color: '#ef4444' }}>
              Error: {progress?.phase === 'error' ? progress.message : errorMessage}
            </span>
          )}
        </div>
      </section>

      {/* Schedule */}
      {schedule && (
        <section className="space-y-2">
          <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Auto-Check Daily
          </label>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            When enabled, the kiosk will check for updates at this time and install
            silently if one is available.
          </p>

          <div className="flex items-center gap-4 mt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) => updateSchedule({ ...schedule, enabled: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Enabled
              </span>
            </label>

            <input
              type="time"
              value={schedule.time}
              disabled={!schedule.enabled}
              onChange={(e) => updateSchedule({ ...schedule, time: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm font-mono outline-none disabled:opacity-50"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </section>
      )}
    </div>
  )
}
