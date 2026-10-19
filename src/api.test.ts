import { describe, expect, it, vi } from 'vitest'
import { api, request } from './api'
import { summarize, type ExpenseInput, type ReservationInput, type VolunteerInput } from './domain'
import { createSeed } from './mocks/seed'
import { ApiError, STORAGE_KEY } from './mocks/store'
import { store } from './test/server'

const reservation: ReservationInput = {
  name: 'André Côté',
  email: 'andre@example.test',
  adults: 2,
  children: 1,
  vegetarian: 3,
  glutenFree: 3,
  paymentStatus: 'pending',
  note: 'Près de la porte.',
}
const volunteer: VolunteerInput = { name: 'André Côté', shiftId: 'kitchen' }
const expense: ExpenseInput = { label: 'Boissons', quantity: '24 bouteilles', amountCents: 1234 }

describe('local API', () => {
  it('loads the seeded organizer', async () => {
    const result = await api.load()
    expect(result).toEqual(store.read())
    expect(summarize(result)).toMatchObject({
      guests: 99,
      pledgedCents: 159_800,
      collectedCents: 98_400,
      expenseCents: 62_000,
      projectedNetCents: 97_800,
    })
  })

  it('performs every mutation and persists the result', async () => {
    const initial = await api.load()
    const event = { ...initial.event, location: 'Salle des voisins' }
    expect((await api.updateEvent(event)).event).toEqual(event)

    const reserved = await api.addReservation(reservation)
    const newReservation = reserved.reservations.at(-1)
    if (!newReservation) throw new Error('Expected a reservation')
    expect(newReservation).toMatchObject({ ...reservation, totalCents: 4600 })
    expect((await api.setPayment(newReservation.id, 'paid')).reservations.at(-1)).toMatchObject({ paymentStatus: 'paid' })
    await api.deleteReservation(newReservation.id)

    const volunteered = await api.addVolunteer(volunteer)
    const newVolunteer = volunteered.volunteers.at(-1)
    if (!newVolunteer) throw new Error('Expected a volunteer')
    await api.deleteVolunteer(newVolunteer.id)

    const expensed = await api.addExpense(expense)
    const newExpense = expensed.expenses.at(-1)
    if (!newExpense) throw new Error('Expected an expense')
    expect((await api.setPurchased(newExpense.id, true)).expenses.at(-1)).toMatchObject({ purchased: true })
    await api.deleteExpense(newExpense.id)

    expect(store.read()).toMatchObject({
      event,
      reservations: initial.reservations,
      volunteers: initial.volunteers,
      expenses: initial.expenses,
    })
  })

  it('propagates validation, conflict, missing-record, and unknown-route messages', async () => {
    await expect(api.addReservation({
      ...reservation, adults: 0, children: 0, vegetarian: 0, glutenFree: 0,
    })).rejects.toThrow('Réservez au moins une place.')
    await expect(api.addReservation({ ...reservation, adults: 82, children: 0 })).rejects.toThrow('Il ne reste que 81 places.')
    await expect(api.deleteExpense('missing')).rejects.toThrow('Cet achat n’existe plus.')
    await expect(request('/does-not-exist')).rejects.toThrow('Cette route API n’existe pas.')
  })

  it('rejects malformed or absent JSON bodies', async () => {
    await expect(request('/reservations', { method: 'POST', body: '{"unfinished":' }))
      .rejects.toThrow('Le corps de la requête doit être du JSON valide.')
    await expect(request('/reservations', { method: 'POST' }))
      .rejects.toThrow('Le corps de la requête doit être du JSON valide.')
  })

  it('reports corrupted storage and recovers through reset', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    window.localStorage.setItem(STORAGE_KEY, '{"broken":')
    await expect(api.load()).rejects.toThrow('Les données locales sont illisibles.')
    expect(log).toHaveBeenCalledWith('[local-api]', expect.any(ApiError))

    const recovered = await api.reset()
    expect(recovered).toEqual({ ...createSeed(), updatedAt: recovered.updatedAt })
  })

  it('honors an aborted load signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(api.load(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
