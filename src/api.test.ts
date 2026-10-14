import { http, HttpResponse, type JsonBodyType } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { api, request } from './api'
import {
  organizerSchema, summarize,
  type ExpenseInput, type ReservationInput, type VolunteerInput,
} from './domain'
import { createSeed } from './mocks/seed'
import { ApiError, STORAGE_KEY } from './mocks/store'
import { server, store } from './test/server'

const origin = window.location.origin
const organizerUrl = `${origin}/api/organizer`
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

interface RequestCase {
  label: string
  path: string
  method: string
  input?: unknown
}

async function fetchApi(path: string, method = 'GET', input?: unknown) {
  return fetch(new URL(`/api${path}`, origin), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  })
}

async function readOrganizer(response: Response, status = 200) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Content-Type')).toContain('application/json')
  const payload: unknown = await response.json()
  const result = organizerSchema.parse(payload)
  expect(result).toEqual(store.read())
  return result
}

async function expectErrorResponse(response: Response, status: number, code: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Content-Type')).toContain('application/json')
  const payload: unknown = await response.json()
  expect(payload).toEqual({ code, error: expect.any(String) })
}

describe('mock API success responses', () => {
  it('returns the complete seeded organizer through an intercepted GET', async () => {
    const result = await readOrganizer(await fetchApi('/organizer'))
    expect(summarize(result)).toMatchObject({
      guests: 99, pledgedCents: 159_800, collectedCents: 98_400,
      expenseCents: 62_000, projectedNetCents: 97_800,
    })
  })

  const creations: Array<RequestCase & {
    collection: 'reservations' | 'volunteers' | 'expenses' | 'tables'
    expected: Record<string, unknown>
  }> = [
    {
      label: 'reservation',
      path: '/reservations',
      method: 'POST',
      input: reservation,
      collection: 'reservations',
      expected: { ...reservation, totalCents: 4600, createdAt: expect.any(String) },
    },
    {
      label: 'volunteer',
      path: '/volunteers',
      method: 'POST',
      input: volunteer,
      collection: 'volunteers',
      expected: { ...volunteer },
    },
    {
      label: 'expense',
      path: '/expenses',
      method: 'POST',
      input: expense,
      collection: 'expenses',
      expected: { ...expense, purchased: false },
    },
    {
      label: 'table',
      path: '/tables',
      method: 'POST',
      input: { label: 'Table des voisins', capacity: 8 },
      collection: 'tables',
      expected: { label: 'Table des voisins', capacity: 8 },
    },
  ]

  it.each(creations)('creates a $label with status 201 and returns the full organizer', async (testCase) => {
    const before = store.read()
    const result = await readOrganizer(await fetchApi(testCase.path, testCase.method, testCase.input), 201)
    expect(result[testCase.collection]).toHaveLength(before[testCase.collection].length + 1)
    expect(result[testCase.collection].at(-1)).toMatchObject({
      ...testCase.expected, id: expect.any(String),
    })
  })

  it('updates event settings with status 200', async () => {
    const event = { ...store.read().event, location: 'Salle des voisins', capacity: 200 }
    const result = await readOrganizer(await fetchApi('/event', 'PUT', event))
    expect(result.event).toEqual(event)
  })

  it('patches a reservation payment with status 200', async () => {
    const result = await readOrganizer(await fetchApi('/reservations/reservation-3', 'PATCH', { paymentStatus: 'paid' }))
    expect(result.reservations.find((item) => item.id === 'reservation-3')).toMatchObject({
      paymentStatus: 'paid', totalCents: 17_400,
    })
    expect(summarize(result).collectedCents).toBe(115_800)
  })

  it('patches an expense purchase with status 200', async () => {
    const result = await readOrganizer(await fetchApi('/expenses/expense-2', 'PATCH', { purchased: true }))
    expect(result.expenses.find((item) => item.id === 'expense-2')).toMatchObject({ purchased: true })
    expect(summarize(result).paidExpenseCents).toBe(29_100)
  })

  const deletions: Array<{ id: string; collection: 'reservations' | 'volunteers' | 'expenses' | 'tables' }> = [
    { id: 'reservation-1', collection: 'reservations' },
    { id: 'volunteer-1', collection: 'volunteers' },
    { id: 'expense-1', collection: 'expenses' },
    { id: 'table-1', collection: 'tables' },
  ]

  it.each(deletions)('deletes $id with status 200', async ({ id, collection }) => {
    const before = store.read()
    const result = await readOrganizer(await fetchApi(`/${collection}/${id}`, 'DELETE'))
    expect(result[collection]).toHaveLength(before[collection].length - 1)
    expect(result[collection].some((item) => item.id === id)).toBe(false)
  })

  it('resets modified data with status 200 and the seed response shape', async () => {
    store.addReservation(reservation)
    store.addExpense(expense)
    const result = await readOrganizer(await fetchApi('/reset', 'POST'))
    expect(result).toEqual({ ...createSeed(), updatedAt: result.updatedAt })
  })
})

describe('mock API validation', () => {
  const invalidRequests: RequestCase[] = [
    { label: 'zero event capacity', path: '/event', method: 'PUT', input: { ...createSeed().event, capacity: 0 } },
    {
      label: 'zero guests', path: '/reservations', method: 'POST',
      input: { ...reservation, adults: 0, children: 0, vegetarian: 0, glutenFree: 0 },
    },
    { label: 'excessive diets', path: '/reservations', method: 'POST', input: { ...reservation, vegetarian: 4 } },
    { label: 'injected sale price', path: '/reservations', method: 'POST', input: { ...reservation, totalCents: 1 } },
    { label: 'null body', path: '/reservations', method: 'POST', input: null },
    {
      label: 'unknown payment status', path: '/reservations/reservation-1', method: 'PATCH',
      input: { paymentStatus: 'refunded' },
    },
    {
      label: 'additional payment fields', path: '/reservations/reservation-1', method: 'PATCH',
      input: { paymentStatus: 'paid', totalCents: 1 },
    },
    { label: 'short volunteer name', path: '/volunteers', method: 'POST', input: { ...volunteer, name: 'A' } },
    { label: 'fractional expense cents', path: '/expenses', method: 'POST', input: { ...expense, amountCents: 1.5 } },
    { label: 'non-boolean purchase', path: '/expenses/expense-1', method: 'PATCH', input: { purchased: 'true' } },
    {
      label: 'additional purchase fields', path: '/expenses/expense-1', method: 'PATCH',
      input: { purchased: true, amountCents: 0 },
    },
    { label: 'negative arrivals', path: '/reservations/reservation-1/arrival', method: 'PUT', input: { arrivedAdults: -1, arrivedChildren: 0 } },
    { label: 'incomplete arrivals', path: '/reservations/reservation-1/arrival', method: 'PUT', input: { arrivedAdults: 1 } },
    { label: 'injected arrival fields', path: '/reservations/reservation-1/arrival', method: 'PUT', input: { arrivedAdults: 1, arrivedChildren: 0, paymentStatus: 'paid' } },
    { label: 'invalid table reference', path: '/reservations/reservation-1/table', method: 'PATCH', input: { tableId: '' } },
    { label: 'absent table reference', path: '/reservations/reservation-1/table', method: 'PATCH', input: {} },
    { label: 'zero table capacity', path: '/tables', method: 'POST', input: { label: 'Voisins', capacity: 0 } },
    { label: 'injected table ID', path: '/tables', method: 'POST', input: { label: 'Voisins', capacity: 8, id: 'injected' } },
    { label: 'fractional table capacity', path: '/tables/table-1', method: 'PUT', input: { label: 'Voisins', capacity: 1.5 } },
  ]

  it.each(invalidRequests)('returns 400 validation_error for $label without saving', async ({ path, method, input }) => {
    const before = store.read()
    await expectErrorResponse(await fetchApi(path, method, input), 400, 'validation_error')
    expect(store.read()).toEqual(before)
  })

  const bodyRoutes: RequestCase[] = [
    { label: 'event update', path: '/event', method: 'PUT' },
    { label: 'reservation creation', path: '/reservations', method: 'POST' },
    { label: 'payment update', path: '/reservations/reservation-1', method: 'PATCH' },
    { label: 'volunteer creation', path: '/volunteers', method: 'POST' },
    { label: 'expense creation', path: '/expenses', method: 'POST' },
    { label: 'purchase update', path: '/expenses/expense-1', method: 'PATCH' },
    { label: 'arrival update', path: '/reservations/reservation-1/arrival', method: 'PUT' },
    { label: 'seating update', path: '/reservations/reservation-1/table', method: 'PATCH' },
    { label: 'table creation', path: '/tables', method: 'POST' },
    { label: 'table update', path: '/tables/table-1', method: 'PUT' },
  ]

  it.each(bodyRoutes)('returns 400 invalid_json for malformed JSON during $label', async ({ path, method }) => {
    const before = store.read()
    const response = await fetch(new URL(`/api${path}`, origin), {
      method, headers: { 'Content-Type': 'application/json' }, body: '{"unfinished":',
    })
    await expectErrorResponse(response, 400, 'invalid_json')
    expect(store.read()).toEqual(before)
  })

  it('returns 400 invalid_json for an absent body', async () => {
    const before = store.read()
    await expectErrorResponse(await fetchApi('/reservations', 'POST'), 400, 'invalid_json')
    expect(store.read()).toEqual(before)
  })
})

describe('mock API conflicts and missing records', () => {
  const conflicts: Array<RequestCase & { code: string; prepare?: () => void }> = [
    {
      label: 'oversold reservation', path: '/reservations', method: 'POST',
      input: { ...reservation, adults: 82, children: 0 }, code: 'sold_out',
    },
    {
      label: 'capacity reduction', path: '/event', method: 'PUT',
      input: { ...createSeed().event, capacity: 98 }, code: 'capacity_conflict',
    },
    {
      label: 'duplicate volunteer', path: '/volunteers', method: 'POST',
      input: { name: '  chloe ROBERT  ', shiftId: 'welcome' }, code: 'duplicate_volunteer',
    },
    {
      label: 'full volunteer shift', path: '/volunteers', method: 'POST',
      input: { name: 'Marc Gagnon', shiftId: 'kitchen' }, code: 'shift_full',
      prepare: () => {
        store.addVolunteer({ name: 'André Côté', shiftId: 'kitchen' })
        store.addVolunteer({ name: 'Louise Roy', shiftId: 'kitchen' })
      },
    },
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

  it.each(conflicts)('returns 409 for $label without saving', async ({ path, method, input, code, prepare }) => {
    prepare?.()
    const before = store.read()
    const persisted = window.localStorage.getItem(STORAGE_KEY)
    await expectErrorResponse(await fetchApi(path, method, input), 409, code)
    expect(store.read()).toEqual(before)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(persisted)
  })

  const missingRequests: RequestCase[] = [
    { label: 'unknown route', path: '/does-not-exist', method: 'GET' },
    { label: 'unknown method', path: '/organizer', method: 'POST' },
    { label: 'unknown collection operation', path: '/reservations', method: 'GET' },
    {
      label: 'missing reservation payment', path: '/reservations/missing', method: 'PATCH',
      input: { paymentStatus: 'paid' },
    },
    { label: 'missing reservation deletion', path: '/reservations/missing', method: 'DELETE' },
    { label: 'unknown shift', path: '/volunteers', method: 'POST', input: { ...volunteer, shiftId: 'missing' } },
    { label: 'missing volunteer deletion', path: '/volunteers/missing', method: 'DELETE' },
    { label: 'missing expense purchase', path: '/expenses/missing', method: 'PATCH', input: { purchased: true } },
    { label: 'missing expense deletion', path: '/expenses/missing', method: 'DELETE' },
    { label: 'missing arrival', path: '/reservations/missing/arrival', method: 'PUT', input: { arrivedAdults: 0, arrivedChildren: 0 } },
    { label: 'missing seating', path: '/reservations/missing/table', method: 'PATCH', input: { tableId: null } },
    { label: 'missing table assignment', path: '/reservations/reservation-1/table', method: 'PATCH', input: { tableId: 'missing' } },
    { label: 'missing table update', path: '/tables/missing', method: 'PUT', input: { label: 'Voisins', capacity: 8 } },
    { label: 'missing table deletion', path: '/tables/missing', method: 'DELETE' },
  ]

  it.each(missingRequests)('returns 404 not_found for $label', async ({ path, method, input }) => {
    const before = store.read()
    await expectErrorResponse(await fetchApi(path, method, input), 404, 'not_found')
    expect(store.read()).toEqual(before)
  })

  it('reports corrupted storage as 500 and permits recovery through the reset endpoint', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.localStorage.setItem(STORAGE_KEY, '{"broken":')
    await expectErrorResponse(await fetchApi('/organizer'), 500, 'storage_corrupt')
    expect(log).toHaveBeenCalledWith('[mock-api]', expect.any(ApiError))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{"broken":')

    const recovered = await readOrganizer(await fetchApi('/reset', 'POST'))
    expect(recovered).toEqual({ ...createSeed(), updatedAt: recovered.updatedAt })
  })

  it('returns a structured 500 for an unexpected backend failure', async () => {
    const cause = new Error('Unexpected failure')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(store, 'read').mockImplementation(() => { throw cause })

    await expectErrorResponse(await fetchApi('/organizer'), 500, 'internal_error')
    expect(log).toHaveBeenCalledWith('[mock-api] Erreur inattendue', cause)
  })
})

describe('API client', () => {
  it('persists event-day mutations through the actual intercepted HTTP client', async () => {
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

  it('loads and performs each mutation through the real intercepted fetch client', async () => {
    const initial = await api.load()
    expect(initial).toEqual(store.read())
    const event = { ...initial.event, location: 'Salle des voisins' }
    expect((await api.updateEvent(event)).event).toEqual(event)

    const reserved = await api.addReservation(reservation)
    const newReservation = reserved.reservations.at(-1)
    if (!newReservation) throw new Error('Expected the new reservation.')
    expect(newReservation).toMatchObject({ ...reservation, totalCents: 4600 })
    const paid = await api.setPayment(newReservation.id, 'paid')
    expect(paid.reservations.at(-1)).toMatchObject({ paymentStatus: 'paid' })
    expect((await api.deleteReservation(newReservation.id)).reservations).toEqual(initial.reservations)

    const volunteered = await api.addVolunteer(volunteer)
    const newVolunteer = volunteered.volunteers.at(-1)
    if (!newVolunteer) throw new Error('Expected the new volunteer.')
    expect(newVolunteer).toMatchObject(volunteer)
    expect((await api.deleteVolunteer(newVolunteer.id)).volunteers).toEqual(initial.volunteers)

    const expensed = await api.addExpense(expense)
    const newExpense = expensed.expenses.at(-1)
    if (!newExpense) throw new Error('Expected the new expense.')
    expect(newExpense).toMatchObject({ ...expense, purchased: false })
    const purchased = await api.setPurchased(newExpense.id, true)
    expect(purchased.expenses.at(-1)).toMatchObject({ purchased: true })
    expect((await api.deleteExpense(newExpense.id)).expenses).toEqual(initial.expenses)

    const reset = await api.reset()
    expect(reset).toEqual({ ...createSeed(), updatedAt: reset.updatedAt })
    expect(reset).toEqual(store.read())
  })

  it('encodes record IDs and sends JSON to the correct origin-relative route', async () => {
    const id = 'invité /? #é'
    let observed: {
      id: string | readonly string[] | undefined
      pathname: string
      contentType: string | null
      body: unknown
    } | undefined
    server.use(http.patch(`${origin}/api/reservations/:id`, async ({ request: incoming, params }) => {
      const body: unknown = await incoming.json()
      observed = {
        id: params.id,
        pathname: new URL(incoming.url).pathname,
        contentType: incoming.headers.get('Content-Type'),
        body,
      }
      return HttpResponse.json(store.read())
    }))

    expect(await api.setPayment(id, 'paid')).toEqual(store.read())
    expect(observed).toEqual({
      id,
      pathname: `/api/reservations/${encodeURIComponent(id)}`,
      contentType: 'application/json',
      body: { paymentStatus: 'paid' },
    })
  })

  it('preserves caller headers alongside the JSON content type', async () => {
    let observed: { contentType: string | null; trace: string | null; body: unknown } | undefined
    server.use(http.post(`${origin}/api/custom`, async ({ request: incoming }) => {
      const body: unknown = await incoming.json()
      observed = {
        contentType: incoming.headers.get('Content-Type'),
        trace: incoming.headers.get('X-Trace'),
        body,
      }
      return HttpResponse.json(store.read())
    }))

    expect(await request('/custom', {
      method: 'POST', headers: { 'X-Trace': 'test' }, body: JSON.stringify({ example: true }),
    })).toEqual(store.read())
    expect(observed).toEqual({
      contentType: 'application/json', trace: 'test', body: { example: true },
    })
  })

  it.each([
    {
      label: 'validation error',
      action: () => api.addReservation({ ...reservation, adults: 0, children: 0, vegetarian: 0, glutenFree: 0 }),
      message: 'Réservez au moins une place.',
    },
    {
      label: 'capacity conflict',
      action: () => api.addReservation({ ...reservation, adults: 82, children: 0 }),
      message: 'Il ne reste que 81 places.',
    },
    {
      label: 'missing record',
      action: () => api.deleteExpense('missing'),
      message: 'Cet achat n’existe plus.',
    },
    {
      label: 'unknown route',
      action: () => request('/does-not-exist'),
      message: 'Cette route API n’existe pas.',
    },
  ])('propagates the backend message for a $label', async ({ action, message }) => {
    const before = store.read()
    await expect(action()).rejects.toThrow(message)
    expect(store.read()).toEqual(before)
  })

  it.each([
    { label: 'missing error fields', payload: { message: 'Unavailable' } },
    { label: 'invalid error code', payload: { error: 'Unavailable', code: 42 } },
    { label: 'null error body', payload: null },
  ])('falls back to the HTTP status for $label', async ({ payload }) => {
    server.use(http.get(organizerUrl, () => HttpResponse.json(payload, { status: 503 })))
    await expect(api.load()).rejects.toThrow('La requête a échoué (503).')
  })

  const invalidOrganizers: Array<{ label: string; payload: JsonBodyType }> = [
    { label: 'missing fields', payload: {} },
    { label: 'unsupported version', payload: { ...createSeed(), schemaVersion: 2 } },
    {
      label: 'fractional persisted cents',
      payload: {
        ...createSeed(),
        expenses: [{ ...createSeed().expenses[0], amountCents: 1.5 }],
      },
    },
  ]

  it.each(invalidOrganizers)('rejects a successful response containing $label', async ({ payload }) => {
    server.use(http.get(organizerUrl, () => HttpResponse.json(payload)))
    await expect(api.load()).rejects.toThrow(
      'Le serveur a renvoyé des données invalides. Réessayez ou réinitialisez la démo.',
    )
  })

  it('rejects malformed response JSON instead of accepting an invalid organizer', async () => {
    server.use(http.get(organizerUrl, () => new HttpResponse('{"unfinished":', {
      headers: { 'Content-Type': 'application/json' },
    })))
    await expect(api.load()).rejects.toThrow('Le serveur n’a pas renvoyé de JSON valide (200). Rechargez la page et réessayez.')
  })

  it('surfaces a genuine intercepted network failure with an actionable message', async () => {
    server.use(http.get(organizerUrl, () => HttpResponse.error()))
    await expect(api.load()).rejects.toThrow('Impossible de joindre le backend simulé. Rechargez la page et réessayez.')
  })

  it('honors the AbortSignal passed to load', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(api.load(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
