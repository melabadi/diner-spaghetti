import { z } from 'zod'
import {
  type EventSettings, type ExpenseInput, type ReservationInput, type VolunteerInput,
} from './domain'
import { ApiError, OrganizerStore } from './mocks/store'

const store = new OrganizerStore(window.localStorage)
const latency = import.meta.env.MODE === 'test' ? 0 : 180

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError')
}

async function wait(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
  if (latency === 0) return
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, latency)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(abortError())
    }, { once: true })
  })
}

function readBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') {
    throw new ApiError(400, 'invalid_json', 'Le corps de la requête doit être du JSON valide.')
  }
  try {
    return JSON.parse(body)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(400, 'invalid_json', 'Le corps de la requête doit être du JSON valide.', { cause: error })
    }
    throw error
  }
}

function recordId(segments: string[]) {
  return z.string().min(1).parse(decodeURIComponent(segments[1] || ''))
}

export async function request(path: string, options: RequestInit = {}) {
  await wait(options.signal || undefined)
  const method = (options.method || 'GET').toUpperCase()
  const segments = path.split('/').filter(Boolean)

  try {
    if (method === 'GET' && path === '/organizer') return store.read()
    if (method === 'PUT' && path === '/event') return store.updateEvent(readBody(options.body))
    if (method === 'POST' && path === '/reservations') return store.addReservation(readBody(options.body))
    if (method === 'PATCH' && segments[0] === 'reservations' && segments.length === 2) {
      return store.setPayment(recordId(segments), readBody(options.body))
    }
    if (method === 'DELETE' && segments[0] === 'reservations' && segments.length === 2) {
      return store.deleteReservation(recordId(segments))
    }
    if (method === 'POST' && path === '/volunteers') return store.addVolunteer(readBody(options.body))
    if (method === 'DELETE' && segments[0] === 'volunteers' && segments.length === 2) {
      return store.deleteVolunteer(recordId(segments))
    }
    if (method === 'POST' && path === '/expenses') return store.addExpense(readBody(options.body))
    if (method === 'PATCH' && segments[0] === 'expenses' && segments.length === 2) {
      return store.setPurchased(recordId(segments), readBody(options.body))
    }
    if (method === 'DELETE' && segments[0] === 'expenses' && segments.length === 2) {
      return store.deleteExpense(recordId(segments))
    }
    if (method === 'POST' && path === '/reset') return store.reset()
    throw new ApiError(404, 'not_found', 'Cette route API n’existe pas.')
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error(error.issues[0].message, { cause: error })
    if (error instanceof ApiError) {
      if (error.status >= 500) console.error('[local-api]', error)
      throw new Error(error.message, { cause: error })
    }
    console.error('[local-api] Erreur inattendue', error)
    throw new Error('Le backend simulé a rencontré une erreur. Réessayez.', { cause: error })
  }
}

function json(method: string, body?: unknown): RequestInit {
  return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }
}

export const api = {
  load: (signal?: AbortSignal) => request('/organizer', { signal }),
  updateEvent: (event: EventSettings) => request('/event', json('PUT', event)),
  addReservation: (reservation: ReservationInput) => request('/reservations', json('POST', reservation)),
  setPayment: (id: string, paymentStatus: ReservationInput['paymentStatus']) =>
    request(`/reservations/${encodeURIComponent(id)}`, json('PATCH', { paymentStatus })),
  deleteReservation: (id: string) => request(`/reservations/${encodeURIComponent(id)}`, json('DELETE')),
  addVolunteer: (volunteer: VolunteerInput) => request('/volunteers', json('POST', volunteer)),
  deleteVolunteer: (id: string) => request(`/volunteers/${encodeURIComponent(id)}`, json('DELETE')),
  addExpense: (expense: ExpenseInput) => request('/expenses', json('POST', expense)),
  setPurchased: (id: string, purchased: boolean) => request(`/expenses/${encodeURIComponent(id)}`, json('PATCH', { purchased })),
  deleteExpense: (id: string) => request(`/expenses/${encodeURIComponent(id)}`, json('DELETE')),
  reset: () => request('/reset', json('POST')),
}
