import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useWeather } from '../../hooks/useWeather'

export default function DateWeatherBadge() {
  const [now, setNow] = useState(new Date())
  const { data: weather } = useWeather()

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="text-white drop-shadow-lg">
      {/* Time */}
      <div className="text-7xl font-bold tracking-tight leading-none">
        {format(now, 'h:mm')}
        <span className="text-4xl font-normal text-white/70 ml-1">{format(now, 'a')}</span>
      </div>

      {/* Date */}
      <div className="text-2xl font-medium text-white/90 mt-1">
        {format(now, 'EEEE, MMMM d')}
      </div>

      {/* Weather */}
      {weather && (
        <div className="flex items-center gap-3 mt-3">
          <img
            src={`https://openweathermap.org/img/wn/${weather.conditionIcon}@2x.png`}
            alt={weather.condition}
            className="w-10 h-10"
          />
          <div>
            <div className="text-3xl font-semibold">{weather.temp}°</div>
            <div className="text-sm text-white/70 capitalize">{weather.conditionDescription}</div>
          </div>
        </div>
      )}
    </div>
  )
}
