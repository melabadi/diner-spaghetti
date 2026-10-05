import { describe, expect, it } from 'vitest'
import {
  eventSchema, normalizeText, reservationInputSchema, summarize, toCents,
  type ReservationInput,
} from './domain'
import { createSeed } from './mocks/seed'

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

describe('toCents', () => {
  it.each([
    ['0', 0],
    ['0.00', 0],
    ['18', 1800],
    ['18.5', 1850],
    ['18,50', 1850],
    [' 19,99 ', 1999],
    ['0.29', 29],
    ['1.01', 101],
    ['0002.05', 205],
    ['1000000.00', 100_000_000],
  ])('converts %s to exactly %i cents', (input, expected) => {
    const result = toCents(input)
    expect(result).toBe(expected)
    expect(Number.isSafeInteger(result)).toBe(true)
  })

  it.each([
    '', ' ', '-1', '+1', '1.001', '1,234', '1.', '1,', '.50', ',50',
    '1e2', 'NaN', 'Infinity', '1 000,00', '1,234.50', '12 $',
  ])('rejects an invalid money string: %j', (input) => {
    expect(() => toCents(input)).toThrow('Indiquez un montant positif avec au plus deux décimales.')
  })

  it.each(['1000000.01', '9007199254740992', '9'.repeat(400)])(
    'rejects an excessive or unsafe amount: %s',
    (input) => {
      expect(() => toCents(input)).toThrow('Le montant est trop élevé.')
    },
  )
})

describe('normalizeText', () => {
  it.each([
    'Émile Côté',
    '  ÉMILE CÔTÉ  ',
    'E\u0301mile Co\u0302te\u0301',
    'emile cote',
  ])('compares names without case or accent differences: %s', (input) => {
    expect(normalizeText(input)).toBe('emile cote')
  })

  it('does not conflate different names', () => {
    expect(normalizeText('Chloé Robert')).not.toBe(normalizeText('Chloé Roy'))
  })
})

describe('summarize', () => {
  it('calculates the seeded attendance, payments, expenses, and net amounts exactly', () => {
    expect(summarize(createSeed())).toEqual({
      guests: 99,
      availableSeats: 81,
      pledgedCents: 159_800,
      collectedCents: 98_400,
      pendingCents: 61_400,
      expenseCents: 62_000,
      paidExpenseCents: 19_500,
      projectedNetCents: 97_800,
      cashNetCents: 78_900,
      budgetRemainingCents: 48_000,
      requiredVolunteers: 16,
      openShifts: 8,
      vegetarian: 17,
      glutenFree: 6,
    })
  })

  it('handles empty collections without NaN or invented payments', () => {
    const seed = createSeed()
    expect(summarize({ ...seed, reservations: [], volunteers: [], expenses: [] })).toEqual({
      guests: 0,
      availableSeats: 180,
      pledgedCents: 0,
      collectedCents: 0,
      pendingCents: 0,
      expenseCents: 0,
      paidExpenseCents: 0,
      projectedNetCents: 0,
      cashNetCents: 0,
      budgetRemainingCents: 110_000,
      requiredVolunteers: 16,
      openShifts: 16,
      vegetarian: 0,
      glutenFree: 0,
    })
  })
})

describe('reservationInputSchema', () => {
  it('trims names and notes and accepts child-only reservations', () => {
    expect(reservationInputSchema.parse({
      ...reservation,
      name: '  André Côté  ',
      adults: 0,
      children: 2,
      note: '  Près de la porte.  ',
    })).toEqual({
      ...reservation,
      adults: 0,
      children: 2,
      note: 'Près de la porte.',
    })
  })

  it('rejects a reservation with no guests', () => {
    const result = reservationInputSchema.safeParse({
      ...reservation, adults: 0, children: 0, vegetarian: 0, glutenFree: 0,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: ['adults'],
        message: 'Réservez au moins une place.',
      }))
    }
  })

  const countFields: Array<'adults' | 'children' | 'vegetarian' | 'glutenFree'> = [
    'adults', 'children', 'vegetarian', 'glutenFree',
  ]

  it.each(countFields.flatMap((field) => [-1, 0.5, 2001].map((value) => ({ field, value }))))(
    'rejects $field=$value',
    ({ field, value }) => {
      const result = reservationInputSchema.safeParse({ ...reservation, [field]: value })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field] }))
      }
    },
  )

  it.each(['vegetarian', 'glutenFree'])('rejects %s above the number of places', (field) => {
    const result = reservationInputSchema.safeParse({ ...reservation, [field]: 4 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field] }))
    }
  })

  it('allows overlapping diets when each count fits within the reservation', () => {
    expect(reservationInputSchema.parse({
      ...reservation, vegetarian: 3, glutenFree: 3,
    })).toMatchObject({ adults: 2, children: 1, vegetarian: 3, glutenFree: 3 })
  })

  it.each([
    { label: 'short name', input: { name: 'A' } },
    { label: 'invalid email', input: { email: 'not-an-email' } },
    { label: 'unknown payment status', input: { paymentStatus: 'refunded' } },
    { label: 'oversized note', input: { note: 'a'.repeat(241) } },
    { label: 'server-owned fields', input: { totalCents: 1 } },
  ])('rejects $label', ({ input }) => {
    expect(reservationInputSchema.safeParse({ ...reservation, ...input }).success).toBe(false)
  })
})

describe('eventSchema', () => {
  it('accepts a leap day, valid time boundaries, zero prices, and a positive goal', () => {
    const event = createSeed().event
    expect(eventSchema.parse({
      ...event,
      name: '  Dîner spaghetti  ',
      location: '  Salle communautaire  ',
      date: '2028-02-29',
      time: '00:00',
      capacity: 1,
      adultPriceCents: 0,
      childPriceCents: 0,
      budgetCents: 0,
      goalCents: 1,
    })).toMatchObject({
      name: 'Dîner spaghetti',
      location: 'Salle communautaire',
      date: '2028-02-29',
      time: '00:00',
      capacity: 1,
      adultPriceCents: 0,
      childPriceCents: 0,
      budgetCents: 0,
      goalCents: 1,
    })
    expect(eventSchema.safeParse({ ...event, time: '23:59', capacity: 2000 }).success).toBe(true)
  })

  it.each([
    { label: 'empty name', input: { name: ' ' } },
    { label: 'short location', input: { location: 'A' } },
    { label: 'non-leap February 29', input: { date: '2026-02-29' } },
    { label: 'impossible day', input: { date: '2026-11-31' } },
    { label: 'localized date', input: { date: '14/11/2026' } },
    { label: 'hour 24', input: { time: '24:00' } },
    { label: 'minute 60', input: { time: '18:60' } },
    { label: 'unpadded time', input: { time: '9:00' } },
    { label: 'zero capacity', input: { capacity: 0 } },
    { label: 'negative capacity', input: { capacity: -1 } },
    { label: 'fractional capacity', input: { capacity: 1.5 } },
    { label: 'excessive capacity', input: { capacity: 2001 } },
    { label: 'zero goal', input: { goalCents: 0 } },
    { label: 'unknown setting', input: { unexpected: true } },
  ])('rejects $label', ({ input }) => {
    expect(eventSchema.safeParse({ ...createSeed().event, ...input }).success).toBe(false)
  })

  const moneyFields: Array<'adultPriceCents' | 'childPriceCents' | 'budgetCents' | 'goalCents'> = [
    'adultPriceCents', 'childPriceCents', 'budgetCents', 'goalCents',
  ]

  it.each(moneyFields.flatMap((field) => [-1, 0.5, 100_000_001].map((value) => ({ field, value }))))(
    'rejects invalid integer cents in $field=$value',
    ({ field, value }) => {
      expect(eventSchema.safeParse({ ...createSeed().event, [field]: value }).success).toBe(false)
    },
  )
})
