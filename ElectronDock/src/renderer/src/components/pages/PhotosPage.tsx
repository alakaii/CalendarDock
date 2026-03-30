import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePhotos } from '../../hooks/usePhotos'
import { useSettingsStore } from '../../store/settings.slice'
import type { SlideshowSortOrder } from '../../../../preload/types'

function parseDateFromFilename(filename: string): number {
  const m = filename.match(/(\d{4})[_\-]?(\d{2})[_\-]?(\d{2})/)
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}`)
    if (!isNaN(d.getTime())) return d.getTime()
  }
  return 0
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function sortPhotos(photos: string[], sortOrder: SlideshowSortOrder): string[] {
  if (photos.length === 0) return photos
  if (sortOrder === 'random') return shuffle(photos)
  if (sortOrder === 'date') {
    return [...photos].sort((a, b) => parseDateFromFilename(b) - parseDateFromFilename(a))
  }
  return [...photos].sort((a, b) => a.localeCompare(b))
}

export default function PhotosPage() {
  const photos = usePhotos()
  const slideshow = useSettingsStore((s) => s.slideshow)

  const sortedPhotos = useMemo(
    () => sortPhotos(photos, slideshow.sortOrder),
    [photos, slideshow.sortOrder] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [index, setIndex] = useState(0)
  const [fade, setFade]   = useState(true)

  const total = sortedPhotos.length

  const goTo = useCallback((next: number) => {
    setFade(false)
    setTimeout(() => {
      setIndex(next)
      setFade(true)
    }, 400)
  }, [])

  // Auto-advance based on slideshow duration setting
  useEffect(() => {
    if (total <= 1) return
    const id = setInterval(() => {
      goTo((index + 1) % total)
    }, slideshow.durationSec * 1000)
    return () => clearInterval(id)
  }, [index, total, goTo, slideshow.durationSec])

  if (total === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}
      >
        <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
        </svg>
        <p className="text-sm">No photos found — set your photo folder in Settings</p>
      </div>
    )
  }

  // cdphoto://photo/<filename> — filename must be in the path, not the hostname
  const src = `cdphoto://photo/${encodeURIComponent(sortedPhotos[index])}`

  return (
    <div
      className="relative flex h-full overflow-hidden"
      style={{ background: '#000' }}
    >
      {/* Main image */}
      <img
        key={sortedPhotos[index]}
        src={src}
        alt=""
        className="w-full h-full object-contain transition-opacity duration-500"
        style={{ opacity: fade ? 1 : 0 }}
        draggable={false}
      />

      {/* Controls overlay */}
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
        <button
          onClick={() => goTo((index - 1 + total) % total)}
          className="pointer-events-auto p-3 rounded-full bg-black/40 text-white hover:bg-black/60
                     transition-colors min-h-[52px] min-w-[52px] flex items-center justify-center"
          aria-label="Previous photo"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => goTo((index + 1) % total)}
          className="pointer-events-auto p-3 rounded-full bg-black/40 text-white hover:bg-black/60
                     transition-colors min-h-[52px] min-w-[52px] flex items-center justify-center"
          aria-label="Next photo"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Counter / dot nav */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
        {total <= 20 ? (
          sortedPhotos.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="w-2 h-2 rounded-full transition-colors"
              style={{ background: i === index ? '#fff' : 'rgba(255,255,255,0.35)' }}
              aria-label={`Photo ${i + 1}`}
            />
          ))
        ) : (
          <span className="text-white/60 text-sm bg-black/40 px-3 py-1 rounded-full">
            {index + 1} / {total}
          </span>
        )}
      </div>
    </div>
  )
}
