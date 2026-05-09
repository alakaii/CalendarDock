import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const CONTAINER = 'wyze-bridge'

export type BridgeStatus = 'running' | 'stopped' | 'not-found' | 'docker-unavailable'

export const wyzeBridgeService = {
  async checkStatus(): Promise<BridgeStatus> {
    try {
      const { stdout } = await execFileAsync('docker', [
        'inspect', '--format={{.State.Running}}', CONTAINER
      ])
      return stdout.trim() === 'true' ? 'running' : 'stopped'
    } catch (err: any) {
      if (err.code === 'ENOENT') return 'docker-unavailable'
      if (err.stderr?.includes('No such object')) return 'not-found'
      return 'docker-unavailable'
    }
  },

  async start(email: string, password: string, apiId: string, apiKey: string): Promise<void> {
    const status = await this.checkStatus()
    if (status === 'docker-unavailable') throw new Error('Docker is not installed or not running')
    if (status === 'running') return

    if (status === 'stopped') {
      await execFileAsync('docker', ['start', CONTAINER])
      return
    }

    // not-found — create fresh container.
    // mrlt8/wyze-bridge requires API_ID + API_KEY since Wyze deprecated plain
    // email/password login. Get these from https://developer-api-console.wyze.com/
    const args = [
      'run', '-d', '--restart', 'unless-stopped',
      '-p', '8554:8554',
      '-p', '8888:8888',
      '-e', `WYZE_EMAIL=${email}`,
      '-e', `WYZE_PASSWORD=${password}`,
    ]
    if (apiId)  args.push('-e', `API_ID=${apiId}`)
    if (apiKey) args.push('-e', `API_KEY=${apiKey}`)
    args.push('--name', CONTAINER, 'mrlt8/wyze-bridge:latest')
    await execFileAsync('docker', args)
  },

  async stop(): Promise<void> {
    try {
      await execFileAsync('docker', ['stop', CONTAINER])
    } catch { /* ignore */ }
  },

  async remove(): Promise<void> {
    try {
      await execFileAsync('docker', ['rm', '-f', CONTAINER])
    } catch { /* ignore */ }
  },

  /** Called on app launch — silently starts bridge if credentials are stored. */
  async ensureRunning(email: string, password: string, apiId: string, apiKey: string): Promise<void> {
    if (!email || !password) return
    try {
      const status = await this.checkStatus()
      if (status === 'stopped') await execFileAsync('docker', ['start', CONTAINER])
      if (status === 'not-found') await this.start(email, password, apiId, apiKey)
    } catch { /* don't crash app if Docker missing */ }
  }
}
