import { settingsService } from './settings.service'

/**
 * One-shot startup pass that copies values from process.env into
 * electron-store settings, but ONLY for fields that are currently empty.
 *
 * The user can still override anything via the in-app Settings UI; this
 * is a "first boot" / SSH-deploy convenience so kiosk credentials can be
 * dropped into `~/.config/calendardock/credentials.env` (already loaded
 * by dotenv at process start) instead of being typed on the touchscreen.
 *
 * Skipped on purpose: anything with a non-empty default (units, host,
 * sizes), and anything OAuth-flow gated (Google/Dropbox/Ring tokens).
 */
export function bootstrapCredentialsFromEnv(): void {
  const env = (k: string): string => (process.env[k] ?? '').trim()
  const cur = settingsService.getAll()

  // Wyze Bridge — used as Docker container env vars on container creation
  if (!cur.wyzeBridgeEmail    && env('WYZE_EMAIL'))    settingsService.set('wyzeBridgeEmail',    env('WYZE_EMAIL'))
  if (!cur.wyzeBridgePassword && env('WYZE_PASSWORD')) settingsService.set('wyzeBridgePassword', env('WYZE_PASSWORD'))
  if (!cur.wyzeBridgeApiId    && env('WYZE_API_ID'))   settingsService.set('wyzeBridgeApiId',    env('WYZE_API_ID'))
  if (!cur.wyzeBridgeApiKey   && env('WYZE_API_KEY'))  settingsService.set('wyzeBridgeApiKey',   env('WYZE_API_KEY'))

  // Rachio
  if (!cur.rachioApiKey && env('RACHIO_API_KEY')) {
    settingsService.setRachioApiKey(env('RACHIO_API_KEY'))
  }

  // Rinnai — paired so we don't end up with half a credential
  if (!cur.rinnaiEmail && !cur.rinnaiPassword && env('RINNAI_EMAIL') && env('RINNAI_PASSWORD')) {
    settingsService.setRinnaiCredentials(env('RINNAI_EMAIL'), env('RINNAI_PASSWORD'))
  }

  // Weather
  if (!cur.weather.apiKey   && env('WEATHER_API_KEY'))  settingsService.setWeatherApiKey(env('WEATHER_API_KEY'))
  if (!cur.weather.location && env('WEATHER_LOCATION')) settingsService.setWeatherLocation(env('WEATHER_LOCATION'))

  // Dropbox app key (browser-based OAuth still required for tokens)
  if (!cur.dropboxAppKey && env('DROPBOX_APP_KEY')) {
    settingsService.setDropboxAppKey(env('DROPBOX_APP_KEY'))
  }

  // Ring email (in-app 2FA still required to actually connect)
  if (!cur.ringAccountEmail && env('RING_EMAIL')) {
    settingsService.setRingAccountEmail(env('RING_EMAIL'))
  }
}
