import { create } from 'zustand'
import type { AppPage } from '../../../preload/types'

type AppMode = 'app' | 'standby'

interface UIState {
  mode: AppMode
  activePage: AppPage
  setMode: (mode: AppMode) => void
  setPage: (page: AppPage) => void
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'app',
  activePage: 'calendar',
  setMode: (mode) => set({ mode }),
  setPage: (page) => set({ activePage: page, mode: 'app' })
}))
