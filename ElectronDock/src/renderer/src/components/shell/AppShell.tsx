import { useEffect, useState } from 'react'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import Sidebar from './Sidebar'
import AppHeader from './AppHeader'
import CalendarView from '../calendar/CalendarView'
import ChoresPage from '../pages/ChoresPage'
import MealsPage from '../pages/MealsPage'
import PhotosPage from '../pages/PhotosPage'
import ListsPage from '../pages/ListsPage'
import SettingsPage from '../pages/SettingsPage'
import CamerasPage from '../pages/CamerasPage'
import SprinklersPage from '../pages/SprinklersPage'
import WaterHeaterPage from '../pages/WaterHeaterPage'
import TeslaPage from '../pages/TeslaPage'

export default function AppShell() {
  const activePage    = useUIStore((s) => s.activePage)
  const artMode       = useSettingsStore((s) => s.artMode)
  const uiOpacity     = useSettingsStore((s) => s.uiOpacity)
  const artScaleMode  = useSettingsStore((s) => s.artScaleMode)
  const artPixelated  = useSettingsStore((s) => s.artPixelated)

  const fullscreen = artMode === 'fullscreen'

  // Serving URL for the fullscreen art file (from userData/backgroundArt/).
  // Re-fetched when fullscreen mode turns on or after the user uploads new art.
  const [artUrl, setArtUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!fullscreen) { setArtUrl(null); return }
    let cancelled = false
    const load = () => window.api.art.getFullscreen().then((u) => { if (!cancelled) setArtUrl(u) })
    load()
    window.addEventListener('fullscreenArtChanged', load)
    return () => { cancelled = true; window.removeEventListener('fullscreenArtChanged', load) }
  }, [fullscreen])

  const rootStyle: React.CSSProperties = {
    background: 'var(--bg-base)',
    color: 'var(--text-primary)',
  }
  if (fullscreen) {
    // isolate → own stacking context so the -z-10 art paints above --bg-base
    // yet below all UI (header / sidebar / main).
    rootStyle.isolation = 'isolate'
    ;(rootStyle as Record<string, string | number>)['--ui-opacity'] = uiOpacity / 100
  }

  return (
    <div
      className={`flex flex-col w-screen h-screen overflow-hidden relative${fullscreen ? ' art-fullscreen' : ''}`}
      style={rootStyle}
    >
      {/* Full-bleed pixel-art layer — sits above --bg-base, below all UI */}
      {fullscreen && artUrl && (
        <img
          aria-hidden="true"
          src={artUrl}
          alt=""
          className="pointer-events-none absolute inset-0 w-full h-full -z-10"
          style={{
            objectFit: artScaleMode === 'fit' ? 'contain' : artScaleMode === 'stretch' ? 'fill' : 'cover',
            imageRendering: artPixelated ? 'pixelated' : 'auto',
          }}
        />
      )}

      {/* Full-width header — spans sidebar + content */}
      <AppHeader />

      {/* Below header: sidebar + page content side-by-side */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-hidden">
          {activePage === 'calendar'    && <CalendarView />}
          {activePage === 'chores'      && <ChoresPage />}
          {activePage === 'meals'       && <MealsPage />}
          {activePage === 'photos'      && <PhotosPage />}
          {activePage === 'lists'       && <ListsPage />}
          {activePage === 'cameras'     && <CamerasPage />}
          {activePage === 'sprinklers'  && <SprinklersPage />}
          {activePage === 'waterheater' && <WaterHeaterPage />}
          {activePage === 'tesla'       && <TeslaPage />}
          {activePage === 'settings'    && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}
