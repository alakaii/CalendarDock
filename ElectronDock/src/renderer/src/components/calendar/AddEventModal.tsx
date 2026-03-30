import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TouchButton } from '../shared/TouchButton'
import type { CalendarListItem } from '../../../../preload/types'

interface AddEventModalProps {
  defaultDate: string
  calendars: CalendarListItem[]
  onClose: () => void
}

export default function AddEventModal({ defaultDate, calendars, onClose }: AddEventModalProps) {
  const queryClient = useQueryClient()

  // Include owner + writer calendars. Fall back to all if roles aren't set.
  const writableCalendars = calendars.filter(
    (c) => c.accessRole === 'owner' || c.accessRole === 'writer'
  )
  const selectableCalendars = writableCalendars.length > 0 ? writableCalendars : calendars

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [calendarId, setCalendarId] = useState(selectableCalendars[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCal = selectableCalendars.find((c) => c.id === calendarId)

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (!calendarId || !selectedCal) { setError('Please select a calendar'); return }
    setSaving(true)
    setError(null)
    try {
      const start = allDay ? date : `${date}T${startTime}:00`
      const end = allDay ? date : `${date}T${endTime}:00`
      await window.api.calendar.createEvent({
        accountId: selectedCal.accountId,
        calendarId,
        title: title.trim(),
        start,
        end,
        allDay
      })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl p-6 max-w-md w-full"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
          New Event
        </h2>

        <div className="space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            autoFocus
            className="w-full rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={inputStyle}
          />

          {/* Calendar selector */}
          {selectableCalendars.length === 0 ? (
            <p className="text-sm text-red-500">
              No writable calendars — make sure calendars are loaded in Settings → Calendars.
            </p>
          ) : (
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              style={inputStyle}
            >
              {selectableCalendars.map((cal) => (
                <option key={cal.id} value={cal.id} style={{ background: 'var(--bg-surface)' }}>
                  {cal.summary}
                </option>
              ))}
            </select>
          )}

          {/* Date */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            style={inputStyle}
          />

          {/* All day toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-5 h-5 accent-blue-500"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>All day</span>
          </label>

          {/* Time pickers */}
          {!allDay && (
            <div className="flex gap-3 items-center">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                style={inputStyle}
              />
              <span style={{ color: 'var(--text-secondary)' }}>–</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                style={inputStyle}
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <TouchButton variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </TouchButton>
          <TouchButton
            variant="primary"
            onClick={handleSave}
            disabled={saving || selectableCalendars.length === 0}
            className="flex-1"
          >
            {saving ? 'Saving...' : 'Save'}
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
