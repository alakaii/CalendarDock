import { useState, useEffect } from 'react'
import { format } from 'date-fns'

export default function StandbyTime() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
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
    </div>
  )
}
