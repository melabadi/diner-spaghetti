import { z } from 'zod'
import {
  organizerSchema,
  type EventSettings, type ExpenseInput, type ReservationInput, type VolunteerInput,
} from './domain'

const errorSchema = z.object({ error: z.string(), code: z.string() })

export async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(new URL(`/api${path}`, window.location.origin), { ...options, headers })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Impossible de joindre le backend simulé. Rechargez la page et réessayez.', { cause: error })
    }
    throw error
  }
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Le serveur n’a pas renvoyé de JSON valide (${response.status}). Rechargez la page et réessayez.`, { cause: error })
    }
    throw error
  }
  if (!response.ok) {
    const result = errorSchema.safeParse(body)
    throw new Error(result.success ? result.data.error : `La requête a échoué (${response.status}).`)
  }
  const result = organizerSchema.safeParse(body)
  if (!result.success) throw new Error('Le serveur a renvoyé des données invalides. Réessayez ou réinitialisez la démo.')
  return result.data
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
