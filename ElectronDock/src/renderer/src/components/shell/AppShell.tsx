import { useUIStore } from '../../store/ui.slice'
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
  const activePage = useUIStore((s) => s.activePage)

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
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
