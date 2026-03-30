import { useState, useEffect } from 'react'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function usePhotos() {
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    // Seed initial list
    window.api.photos.getList().then((list) => {
      if (list.length > 0) setPhotos(shuffle(list))
    })

    // Subscribe to updates from the watcher
    window.api.photos.onListUpdated((list) => {
      setPhotos((prev) => {
        // Keep shuffle order, just add/remove
        const prevSet = new Set(prev)
        const newSet = new Set(list)
        const kept = prev.filter((p) => newSet.has(p))
        const added = list.filter((p) => !prevSet.has(p))
        return [...kept, ...shuffle(added)]
      })
    })
  }, [])

  return photos
}
