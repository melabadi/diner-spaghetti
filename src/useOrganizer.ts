import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { Organizer } from './domain'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue. Réessayez.'
}

export type RunAction = (action: () => Promise<Organizer>, success: string) => Promise<boolean>

export function useOrganizer() {
  const [data, setData] = useState<Organizer | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    api.load(controller.signal).then(setData).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(error))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [])

  const run: RunAction = useCallback(async (action, success) => {
    if (inFlight.current) {
      setError('Une action est déjà en cours. Patientez un instant.')
      return false
    }
    inFlight.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      setData(await action())
      setNotice(success)
      return true
    } catch (error) {
      setError(errorMessage(error))
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  const reportError = (message: string) => {
    setNotice(null)
    setError(message)
  }

  return { data, loading, busy, error, notice, run, reportError }
}
