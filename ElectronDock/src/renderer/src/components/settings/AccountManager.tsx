import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TouchButton } from '../shared/TouchButton'
import { useSettingsStore } from '../../store/settings.slice'

export default function AccountManager() {
  const queryClient = useQueryClient()
  const loadSettings = useSettingsStore((s) => s.loadFromMain)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: accounts = [], refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => window.api.auth.listAccounts(),
    staleTime: 0
  })

  const handleAddAccount = async () => {
    setAdding(true)
    setError(null)
    try {
      await window.api.auth.startFlow()
      await refetch()
      await loadSettings()
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect account')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveAccount = async (accountId: string) => {
    try {
      await window.api.auth.removeAccount(accountId)
      await refetch()
      await loadSettings()
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove account')
    }
  }

  return (
    <div className="max-w-lg">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Google Accounts</h3>

      <div className="space-y-3 mb-6">
        {accounts.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No accounts connected yet.</p>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            {account.photoUrl ? (
              <img src={account.photoUrl} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-sm font-bold text-white">
                {account.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {account.displayName}
              </div>
              <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                {account.email}
              </div>
            </div>
            <TouchButton
              variant="ghost"
              onClick={() => handleRemoveAccount(account.id)}
              className="text-red-500 hover:text-red-400 text-sm px-3 flex-shrink-0"
            >
              Remove
            </TouchButton>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <TouchButton
        variant="primary"
        onClick={handleAddAccount}
        disabled={adding}
        className="w-full"
      >
        {adding ? 'Opening browser...' : '+ Add Google Account'}
      </TouchButton>

      {adding && (
        <p className="text-sm mt-3 text-center" style={{ color: 'var(--text-secondary)' }}>
          Complete sign-in in the browser window that opened.
        </p>
      )}
    </div>
  )
}
