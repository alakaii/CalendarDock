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

export default function AppShell() {
  const activePage = useUIStore((s) => s.activePage)

  return (
    <div
      className="flex w-screen h-screen overflow-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content: header + page */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader />

        <main className="flex-1 overflow-hidden">
          {activePage === 'calendar'    && <CalendarView />}
          {activePage === 'chores'      && <ChoresPage />}
          {activePage === 'meals'       && <MealsPage />}
          {activePage === 'photos'      && <PhotosPage />}
          {activePage === 'lists'       && <ListsPage />}
          {activePage === 'cameras'     && <CamerasPage />}
          {activePage === 'sprinklers'  && <SprinklersPage />}
          {activePage === 'waterheater' && <WaterHeaterPage />}
          {activePage === 'settings'    && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}
