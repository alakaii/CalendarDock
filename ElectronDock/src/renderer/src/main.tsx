import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './api-mock' // No-op in Electron; installs mock when running in browser
import { installRendererLogBridge } from './utils/logBridge'

// Forward renderer console.error / warn / unhandled errors to main → journalctl
installRendererLogBridge()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      // Kiosk boot race: the app launches before WiFi associates, so the very
      // first calendar / weather / Tesla fetch fails with DNS errors. React
      // Query's built-in 'online' listener will fire all queries again the
      // moment the network comes back up — no manual retry button required.
      refetchOnReconnect: true
    }
  }
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
