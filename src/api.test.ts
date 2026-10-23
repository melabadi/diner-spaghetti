import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
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

  it('persists every event-day mutation through the local API', async () => {
    const initial = await api.load()
    const created = await api.addTable({ label: 'Table des voisins', capacity: 8 })
    const table = created.tables.at(-1)
    if (!table) throw new Error('Expected the new table.')
    expect((await api.updateTable(table.id, { label: 'Table du quartier', capacity: 8 })).tables.at(-1)?.label).toBe('Table du quartier')
    const assigned = await api.setTable('reservation-1', table.id)
    expect(assigned.reservations[0].tableId).toBe(table.id)
    const arrived = await api.setArrival('reservation-1', { arrivedAdults: 2, arrivedChildren: 1 })
    expect(arrived.reservations[0]).toMatchObject({ arrivedAdults: 2, arrivedChildren: 1, tableId: table.id })
    expect(await api.load()).toEqual(arrived)
    await api.setTable('reservation-1', null)
    expect((await api.deleteTable(table.id)).tables).toEqual(initial.tables)
    const reset = await api.reset()
    expect(reset.reservations).toEqual(initial.reservations)
    expect(reset.tables).toEqual(initial.tables)
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

  describe('event-day local API validation', () => {
    const invalidRequests = [
      { label: 'negative arrivals', path: '/reservations/reservation-1/arrival', method: 'PUT', input: { arrivedAdults: -1, arrivedChildren: 0 } },
      { label: 'incomplete arrivals', path: '/reservations/reservation-1/arrival', method: 'PUT', input: { arrivedAdults: 1 } },
      { label: 'injected arrival fields', path: '/reservations/reservation-1/arrival', method: 'PUT', input: { arrivedAdults: 1, arrivedChildren: 0, paymentStatus: 'paid' } },
      { label: 'invalid table reference', path: '/reservations/reservation-1/table', method: 'PATCH', input: { tableId: '' } },
      { label: 'absent table reference', path: '/reservations/reservation-1/table', method: 'PATCH', input: {} },
      { label: 'zero table capacity', path: '/tables', method: 'POST', input: { label: 'Voisins', capacity: 0 } },
      { label: 'injected table ID', path: '/tables', method: 'POST', input: { label: 'Voisins', capacity: 8, id: 'injected' } },
      { label: 'fractional table capacity', path: '/tables/table-1', method: 'PUT', input: { label: 'Voisins', capacity: 1.5 } },
    ]

    it.each(invalidRequests)('rejects $label without saving', async ({ path, method, input }) => {
      const before = store.read()
      const persisted = window.localStorage.getItem(STORAGE_KEY)
      await expect(request(path, { method, body: JSON.stringify(input) }))
        .rejects.toMatchObject({ cause: expect.any(z.ZodError) })
      expect(store.read()).toEqual(before)
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(persisted)
    })

    const bodyRoutes = [
      { path: '/reservations/reservation-1/arrival', method: 'PUT' },
      { path: '/reservations/reservation-1/table', method: 'PATCH' },
      { path: '/tables', method: 'POST' },
      { path: '/tables/table-1', method: 'PUT' },
    ]

    it.each(bodyRoutes)('rejects malformed and absent JSON for $method $path', async ({ path, method }) => {
      const before = store.read()
      for (const body of ['{"unfinished":', undefined]) {
        await expect(request(path, { method, body }))
          .rejects.toMatchObject({ cause: { status: 400, code: 'invalid_json' } })
        expect(store.read()).toEqual(before)
      }
    })

    const conflicts: Array<{
      label: string; path: string; method: string; input?: unknown
      code: string; prepare?: () => void
    }> = [
      {
        label: 'excessive arrivals', path: '/reservations/reservation-1/arrival', method: 'PUT',
        input: { arrivedAdults: 7, arrivedChildren: 0 }, code: 'arrival_conflict',
      },
      {
        label: 'overfilled table', path: '/reservations/reservation-3/table', method: 'PATCH',
        input: { tableId: 'table-1' }, code: 'table_full',
      },
      {
        label: 'occupied table deletion', path: '/tables/table-1', method: 'DELETE', code: 'table_in_use',
        prepare: () => { store.setTable('reservation-1', { tableId: 'table-1' }) },
      },
      {
        label: 'occupied table reduction', path: '/tables/table-1', method: 'PUT',
        input: { label: 'Table 1', capacity: 7 }, code: 'table_capacity_conflict',
        prepare: () => { store.setTable('reservation-1', { tableId: 'table-1' }) },
      },
      {
        label: 'duplicate table', path: '/tables', method: 'POST',
        input: { label: '  TABLE 1  ', capacity: 8 }, code: 'duplicate_table',
      },
      {
        label: 'seating beyond venue capacity', path: '/tables', method: 'POST',
        input: { label: 'Grande tablée', capacity: 109 }, code: 'seating_capacity_conflict',
      },
    ]

    it.each(conflicts)('rejects $label without saving', async ({ path, method, input, code, prepare }) => {
      prepare?.()
      const before = store.read()
      const persisted = window.localStorage.getItem(STORAGE_KEY)
      await expect(request(path, { method, body: JSON.stringify(input) }))
        .rejects.toMatchObject({ cause: { status: 409, code } })
      expect(store.read()).toEqual(before)
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(persisted)
    })

    const missingRequests = [
      { path: '/reservations/missing/arrival', method: 'PUT', input: { arrivedAdults: 0, arrivedChildren: 0 } },
      { path: '/reservations/missing/table', method: 'PATCH', input: { tableId: null } },
      { path: '/reservations/reservation-1/table', method: 'PATCH', input: { tableId: 'missing' } },
      { path: '/tables/missing', method: 'PUT', input: { label: 'Voisins', capacity: 8 } },
      { path: '/tables/missing', method: 'DELETE' },
    ]

    it.each(missingRequests)('reports a missing record for $method $path', async ({ path, method, input }) => {
      const before = store.read()
      await expect(request(path, { method, body: JSON.stringify(input) }))
        .rejects.toMatchObject({ cause: { status: 404, code: 'not_found' } })
      expect(store.read()).toEqual(before)
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
