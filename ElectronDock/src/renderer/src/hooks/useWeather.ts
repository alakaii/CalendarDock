import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '../store/settings.slice'

export function useWeather() {
  const location = useSettingsStore((s) => s.weather.location)
  const apiKey = useSettingsStore((s) => s.weather.apiKey)

  return useQuery({
    queryKey: ['weather', location],
    queryFn: () => window.api.weather.fetch(),
    // apiKey is masked as '••••••••' in the renderer (security) — truthy means a real key exists
    enabled: !!location && !!apiKey,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1
  })
}

/** Fetches the 6-day forecast. Only runs when `enabled` is true (lazy on panel open). */
export function useForecast(enabled: boolean) {
  const location = useSettingsStore((s) => s.weather.location)
  const apiKey   = useSettingsStore((s) => s.weather.apiKey)

  return useQuery({
    queryKey: ['weather-forecast', location],
    queryFn:  () => window.api.weather.fetchForecast(),
    enabled:  enabled && !!location && !!apiKey,
    staleTime: 60 * 60 * 1000,      // 1 hour — forecast doesn't change that fast
    refetchInterval: 3 * 60 * 60 * 1000, // re-fetch every 3 hours
    retry: 1
  })
}
