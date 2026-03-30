import { useWeather } from '../../hooks/useWeather'
import type { StandbyWeatherFields } from '../../../../preload/types'

interface Props {
  fields: StandbyWeatherFields
}

export default function StandbyWeather({ fields }: Props) {
  const { data: weather } = useWeather()

  if (!weather) return null

  return (
    <div className="text-white drop-shadow-lg flex items-start gap-3">
      {/* Weather icon always shown */}
      <img
        src={`https://openweathermap.org/img/wn/${weather.conditionIcon}@2x.png`}
        alt={weather.condition}
        className="w-10 h-10 flex-shrink-0"
      />
      <div>
        {fields.temperature && (
          <div className="text-3xl font-semibold">{weather.temp}°</div>
        )}
        {fields.condition && (
          <div className="text-sm text-white/70 capitalize">{weather.conditionDescription}</div>
        )}
        {fields.feelsLike && (
          <div className="text-sm text-white/70">Feels like {weather.feelsLike}°</div>
        )}
        {fields.humidity && (
          <div className="text-sm text-white/70">Humidity {weather.humidity}%</div>
        )}
        {fields.city && (
          <div className="text-sm text-white/70">{weather.city}</div>
        )}
      </div>
    </div>
  )
}
