import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { organizerSchema, summarize, type ReservationInput } from '../domain'
import { createSeed } from './seed'
import { ApiError, OrganizerStore, STORAGE_KEY, type StorageAdapter } from './store'

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const reservation: ReservationInput = {
  name: 'André Côté',
  email: 'andre@example.test',
  adults: 2,
  children: 1,
  vegetarian: 1,
  glutenFree: 1,
  paymentStatus: 'pending',
  note: '',
}

function expectApiError(action: () => unknown, status: number, code: string) {
  let caught: unknown
  try {
    action()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(ApiError)
  if (!(caught instanceof ApiError)) throw new Error('Expected an ApiError.')
  expect(caught).toMatchObject({ status, code, message: expect.any(String) })
  expect(caught.message.length).toBeGreaterThan(0)
  return caught
}

let storage: MemoryStorage
let store: OrganizerStore

beforeEach(() => {
  storage = new MemoryStorage()
  store = new OrganizerStore(storage)
})

describe('OrganizerStore persistence', () => {
  it('seeds empty storage once and exposes the same data through a fresh store', () => {
    const first = store.read()
    expect(organizerSchema.safeParse(first).success).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(first))
    expect(new OrganizerStore(storage).read()).toEqual(first)
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(first))
  })

  it('persists mutations across new store instances using the same storage', () => {
    store.addReservation(reservation)
    store.setPayment('reservation-3', { paymentStatus: 'paid' })
    store.addVolunteer({ name: 'André Côté', shiftId: 'kitchen' })
    store.addExpense({ label: 'Boissons', quantity: '24 bouteilles', amountCents: 1234 })
    store.setPurchased('expense-2', { purchased: true })
    const updated = store.updateEvent({ ...store.read().event, location: 'Salle des voisins' })

    expect(new OrganizerStore(storage).read()).toEqual(updated)
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(updated))
  })

  it('does not persist arbitrary changes to a returned snapshot', () => {
    const snapshot = store.read()
    const persisted = storage.getItem(STORAGE_KEY)
    snapshot.event.name = 'Changement non enregistré'
    snapshot.reservations.pop()

    expect(storage.getItem(STORAGE_KEY)).toBe(persisted)
    expect(store.read().event.name).toBe('Dîner spaghetti')
    expect(store.read().reservations).toHaveLength(8)
  })
})

describe('reservation capacity and prices', () => {
  it('accepts a reservation exactly filling the remaining capacity', () => {
    const result = store.addReservation({
      ...reservation, adults: 81, children: 0, vegetarian: 0, glutenFree: 0,
    })
    expect(summarize(result)).toMatchObject({ guests: 180, availableSeats: 0 })
    expect(result.reservations.at(-1)).toMatchObject({ adults: 81, totalCents: 145_800 })
    expect(store.read()).toEqual(result)
  })

  it('rejects overselling without changing any persisted data', () => {
    const before = store.read()
    const raw = storage.getItem(STORAGE_KEY)
    expectApiError(() => store.addReservation({
      ...reservation, adults: 82, children: 0,
    }), 409, 'sold_out')
    expect(store.read()).toEqual(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('allows capacity equal to attendance and rejects a further reduction atomically', () => {
    const atBoundary = store.updateEvent({ ...store.read().event, capacity: 99 })
    expect(summarize(atBoundary).availableSeats).toBe(0)
    const raw = storage.getItem(STORAGE_KEY)

    expectApiError(() => store.updateEvent({ ...atBoundary.event, capacity: 98 }), 409, 'capacity_conflict')
    expect(store.read()).toEqual(atBoundary)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('rejects any additional reservation once capacity has been filled', () => {
    const full = store.updateEvent({ ...store.read().event, capacity: 99 })
    const error = expectApiError(() => store.addReservation({
      ...reservation, adults: 1, children: 0,
    }), 409, 'sold_out')
    expect(error.message).toContain('0 place')
    expect(store.read()).toEqual(full)
  })

  it('preserves each sale price and uses the new prices only for new reservations', () => {
    const original = store.read()
    const repriced = store.updateEvent({
      ...original.event, adultPriceCents: 1999, childPriceCents: 1050,
    })
    expect(repriced.reservations).toEqual(original.reservations)
    expect(summarize(repriced).pledgedCents).toBe(159_800)

    const reserved = store.addReservation(reservation)
    expect(reserved.reservations.at(-1)).toMatchObject({
      ...reservation,
      id: expect.any(String),
      createdAt: expect.any(String),
      totalCents: 5048,
    })
    expect(summarize(reserved).pledgedCents).toBe(164_848)

    const repricedAgain = store.updateEvent({
      ...reserved.event, adultPriceCents: 3000, childPriceCents: 500,
    })
    expect(repricedAgain.reservations).toEqual(reserved.reservations)
    expect(new OrganizerStore(storage).read()).toEqual(repricedAgain)
  })

  it('persists the maximum multi-ticket total when each ticket has a valid high price', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...createSeed(), reservations: [] }))
    store.updateEvent({
      ...store.read().event,
      capacity: 2000,
      adultPriceCents: 100_000_000,
      childPriceCents: 100_000_000,
    })

    const reserved = store.addReservation({ ...reservation, adults: 1000, children: 1000 })
    expect(reserved.reservations.at(-1)).toMatchObject({
      adults: 1000, children: 1000, totalCents: 200_000_000_000,
    })
    expect(summarize(reserved)).toMatchObject({
      guests: 2000,
      availableSeats: 0,
      pledgedCents: 200_000_000_000,
      collectedCents: 0,
      pendingCents: 200_000_000_000,
    })
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(reserved))
    expect(new OrganizerStore(storage).read()).toEqual(reserved)
  })
})

describe('payments and reservation deletion', () => {
  it('moves a price snapshot between paid and pending totals without changing the pledge', () => {
    const before = summarize(store.read())
    const paid = store.setPayment('reservation-3', { paymentStatus: 'paid' })
    expect(paid.reservations.find((item) => item.id === 'reservation-3')).toMatchObject({
      paymentStatus: 'paid', totalCents: 17_400,
    })
    expect(summarize(paid)).toMatchObject({
      pledgedCents: 159_800, collectedCents: 115_800, pendingCents: 44_000,
    })

    const pending = store.setPayment('reservation-3', { paymentStatus: 'pending' })
    expect(summarize(pending)).toEqual(before)
    expect(store.read()).toEqual(pending)
  })

  it.each([
    { id: 'reservation-1', guests: 8, totalCents: 12_800, paidCents: 12_800 },
    { id: 'reservation-3', guests: 11, totalCents: 17_400, paidCents: 0 },
  ])('removes attendance and the appropriate totals when deleting $id', ({ id, guests, totalCents, paidCents }) => {
    const result = store.deleteReservation(id)
    expect(result.reservations.some((item) => item.id === id)).toBe(false)
    expect(summarize(result)).toMatchObject({
      guests: 99 - guests,
      availableSeats: 81 + guests,
      pledgedCents: 159_800 - totalCents,
      collectedCents: 98_400 - paidCents,
      pendingCents: 61_400 - totalCents + paidCents,
      projectedNetCents: 97_800 - totalCents,
    })
    expect(store.read()).toEqual(result)
  })
})

describe('volunteer shifts', () => {
  it('rejects accent- and case-insensitive duplicate names within the same shift', () => {
    const before = store.read()
    const raw = storage.getItem(STORAGE_KEY)
    expectApiError(() => store.addVolunteer({
      name: '  chloe ROBERT  ', shiftId: 'welcome',
    }), 409, 'duplicate_volunteer')
    expect(store.read()).toEqual(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('allows the same person to volunteer for a different shift', () => {
    const result = store.addVolunteer({ name: 'Chloé Robert', shiftId: 'kitchen' })
    expect(result.volunteers.at(-1)).toMatchObject({
      id: expect.any(String), name: 'Chloé Robert', shiftId: 'kitchen',
    })
    expect(summarize(result).openShifts).toBe(7)
  })

  it('accepts the final shift opening and rejects further assignments without persisting them', () => {
    store.addVolunteer({ name: 'André Côté', shiftId: 'kitchen' })
    const full = store.addVolunteer({ name: 'Louise Roy', shiftId: 'kitchen' })
    expect(full.volunteers.filter((item) => item.shiftId === 'kitchen')).toHaveLength(4)
    const raw = storage.getItem(STORAGE_KEY)

    expectApiError(() => store.addVolunteer({
      name: 'Marc Gagnon', shiftId: 'kitchen',
    }), 409, 'shift_full')
    expect(store.read()).toEqual(full)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('reopens a shift when an assignment is deleted', () => {
    const result = store.deleteVolunteer('volunteer-1')
    expect(result.volunteers.some((item) => item.id === 'volunteer-1')).toBe(false)
    expect(summarize(result).openShifts).toBe(9)
    expect(store.read()).toEqual(result)
  })
})

describe('expenses', () => {
  it('adds exact cents as unpurchased, then toggles cash spending without changing projected spending', () => {
    const created = store.addExpense({ label: 'Boissons', quantity: '24 bouteilles', amountCents: 1234 })
    const expense = created.expenses.at(-1)
    expect(expense).toMatchObject({
      id: expect.any(String), label: 'Boissons', quantity: '24 bouteilles',
      amountCents: 1234, purchased: false,
    })
    if (!expense) throw new Error('Expected the new expense.')
    expect(summarize(created)).toMatchObject({
      expenseCents: 63_234, paidExpenseCents: 19_500, projectedNetCents: 96_566,
    })

    const purchased = store.setPurchased(expense.id, { purchased: true })
    expect(summarize(purchased)).toMatchObject({
      expenseCents: 63_234, paidExpenseCents: 20_734, cashNetCents: 77_666,
    })
    const unpurchased = store.setPurchased(expense.id, { purchased: false })
    expect(summarize(unpurchased)).toEqual(summarize(created))
    expect(store.read()).toEqual(unpurchased)
  })

  it.each([
    { id: 'expense-1', amountCents: 4200, paidCents: 4200 },
    { id: 'expense-2', amountCents: 9600, paidCents: 0 },
  ])('updates budget and cash correctly when deleting $id', ({ id, amountCents, paidCents }) => {
    const result = store.deleteExpense(id)
    expect(result.expenses.some((item) => item.id === id)).toBe(false)
    expect(summarize(result)).toMatchObject({
      pledgedCents: 159_800,
      collectedCents: 98_400,
      expenseCents: 62_000 - amountCents,
      paidExpenseCents: 19_500 - paidCents,
      projectedNetCents: 97_800 + amountCents,
      cashNetCents: 78_900 + paidCents,
      budgetRemainingCents: 48_000 + amountCents,
    })
    expect(store.read()).toEqual(result)
  })
})

describe('missing records and invalid mutations', () => {
  it.each([
    { label: 'payment for a missing reservation', action: () => store.setPayment('missing', { paymentStatus: 'paid' }) },
    { label: 'deleting a missing reservation', action: () => store.deleteReservation('missing') },
    { label: 'assigning an unknown shift', action: () => store.addVolunteer({ name: 'André Côté', shiftId: 'missing' }) },
    { label: 'deleting a missing volunteer', action: () => store.deleteVolunteer('missing') },
    { label: 'purchase for a missing expense', action: () => store.setPurchased('missing', { purchased: true }) },
    { label: 'deleting a missing expense', action: () => store.deleteExpense('missing') },
  ])('rejects $label without changing storage', ({ action }) => {
    const before = store.read()
    const raw = storage.getItem(STORAGE_KEY)
    expectApiError(action, 404, 'not_found')
    expect(store.read()).toEqual(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it.each([
    { label: 'fractional guests', action: () => store.addReservation({ ...reservation, adults: 1.5 }) },
    { label: 'invalid event', action: () => store.updateEvent({ ...store.read().event, capacity: 0 }) },
    { label: 'unknown payment status', action: () => store.setPayment('reservation-1', { paymentStatus: 'refunded' }) },
    { label: 'additional payment fields', action: () => store.setPayment('reservation-1', { paymentStatus: 'paid', totalCents: 0 }) },
    { label: 'short volunteer name', action: () => store.addVolunteer({ name: 'A', shiftId: 'kitchen' }) },
    { label: 'negative expense', action: () => store.addExpense({ label: 'Boissons', quantity: '24', amountCents: -1 }) },
    { label: 'non-boolean purchase', action: () => store.setPurchased('expense-1', { purchased: 'yes' }) },
  ])('does not save $label', ({ action }) => {
    const before = store.read()
    const raw = storage.getItem(STORAGE_KEY)
    expect(action).toThrow(ZodError)
    expect(store.read()).toEqual(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })
})

describe('storage errors and recovery', () => {
  it.each([
    { label: 'malformed JSON', raw: '{"broken":', cause: SyntaxError },
    { label: 'null data', raw: 'null', cause: ZodError },
    { label: 'unsupported schema version', raw: JSON.stringify({ ...createSeed(), schemaVersion: 2 }), cause: ZodError },
  ])('reports $label without silently overwriting it, then recovers through reset', ({ raw, cause }) => {
    storage.setItem(STORAGE_KEY, raw)
    const error = expectApiError(() => store.read(), 500, 'storage_corrupt')
    expect(error.cause).toBeInstanceOf(cause)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)

    const recovered = store.reset()
    expect(recovered).toEqual({ ...createSeed(), updatedAt: recovered.updatedAt })
    expect(new OrganizerStore(storage).read()).toEqual(recovered)
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(recovered))
  })

  it('reports inaccessible storage with the original cause instead of default data', () => {
    const cause = new Error('Storage access denied')
    const write = vi.spyOn(storage, 'setItem')
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw cause })

    const error = expectApiError(() => store.read(), 500, 'storage_unavailable')
    expect(error.cause).toBe(cause)
    expect(write).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'initial seed', action: () => store.read() },
    { label: 'reset', action: () => store.reset() },
  ])('reports failed persistence during $label instead of returning unsaved defaults', ({ action }) => {
    const cause = new Error('Storage quota exceeded')
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw cause })

    const error = expectApiError(action, 500, 'storage_write_failed')
    expect(error.cause).toBe(cause)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('preserves the previous persisted data when saving a mutation fails, then allows a retry', () => {
    const before = store.read()
    const raw = storage.getItem(STORAGE_KEY)
    const cause = new Error('Storage quota exceeded')
    const write = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw cause })

    const error = expectApiError(() => store.addReservation(reservation), 500, 'storage_write_failed')
    expect(error.cause).toBe(cause)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    expect(store.read()).toEqual(before)

    write.mockRestore()
    const retried = store.addReservation(reservation)
    expect(retried.reservations).toHaveLength(before.reservations.length + 1)
    expect(new OrganizerStore(storage).read()).toEqual(retried)
  })
})
