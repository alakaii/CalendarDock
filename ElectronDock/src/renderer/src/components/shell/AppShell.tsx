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
  const activePage      = useUIStore((s) => s.activePage)
  const whiteboxPreview = useUIStore((s) => s.whiteboxPreview)
  const artMode         = useSettingsStore((s) => s.artMode)
  const uiOpacity       = useSettingsStore((s) => s.uiOpacity)
  const artScaleMode    = useSettingsStore((s) => s.artScaleMode)
  const artPixelated    = useSettingsStore((s) => s.artPixelated)
  const whiteboxOpacity = useSettingsStore((s) => s.whiteboxOpacity)

  const fullscreen = artMode === 'fullscreen'

  // Live settings preview: on the settings page, while the user drags the
  // whitebox veil slider, mount the real CalendarView behind the settings UI
  // and cut out the right third so the calendar (with art + veil) shows through.
  // Mounts once when the drag engages and unmounts when it disengages, so
  // FullCalendar isn't churned per slider tick.
  const previewActive = fullscreen && whiteboxPreview && activePage === 'settings'

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

        <main className="flex-1 overflow-hidden relative isolate">
          {/* Whitebox softening veil — a white layer scoped to the main page
              area only (not header/sidebar). -z-10 (inside main's isolate
              stacking context) puts it above the transparent main background,
              hence above the full-bleed art, yet below the translucent page
              panels: art → whitebox → panels. */}
          {fullscreen && whiteboxOpacity > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ background: `rgba(255,255,255,${whiteboxOpacity / 100})` }}
            />
          )}

          {activePage === 'calendar'    && <CalendarView />}
          {activePage === 'chores'      && <ChoresPage />}
          {activePage === 'meals'       && <MealsPage />}
          {activePage === 'photos'      && <PhotosPage />}
          {activePage === 'lists'       && <ListsPage />}
          {activePage === 'cameras'     && <CamerasPage />}
          {activePage === 'sprinklers'  && <SprinklersPage />}
          {activePage === 'waterheater' && <WaterHeaterPage />}
          {activePage === 'tesla'       && <TeslaPage />}

          {/* Settings page. In preview mode the live CalendarView fills the main
              area behind, and the settings container shrinks to the left two
              thirds — its right third is cut out so the calendar's Thu–Sat-ish
              columns (with art + veil) show through, live-updating as the slider
              moves. The SettingsPage element stays at a stable tree position
              across the toggle so it (and the slider capturing the pointer) is
              never remounted mid-drag. */}
          {activePage === 'settings' && (
            <>
              {previewActive && (
                <div className="absolute inset-0 z-0" aria-hidden="true">
                  <CalendarView />
                </div>
              )}
              <div
                className={previewActive ? 'absolute inset-y-0 left-0 z-10 overflow-hidden' : 'h-full'}
                style={previewActive ? { width: '66.6667%' } : undefined}
              >
                <SettingsPage />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
