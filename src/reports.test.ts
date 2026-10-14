import { describe, expect, it } from 'vitest'
import { createSeed } from './mocks/seed'
import { buildServiceReports } from './reports'

describe('service reports', () => {
  it('includes every contact in French name order without exporting email addresses', () => {
    const data = createSeed()
    const original = [...data.reservations]
    const { door } = buildServiceReports(data)
    expect(door).toHaveLength(8)
    expect(door[0]).toEqual({
      id: 'reservation-5', name: 'Alice Moreau', adults: 4, children: 2,
      arrivedAdults: 0, arrivedChildren: 0, table: 'À placer',
      paymentStatus: 'pending', dueCents: 9200, note: '',
    })
    expect(door.map((row) => row.name)).toEqual([
      'Alice Moreau', 'Camille Roy', 'Collectif des voisins', 'Émile Côté',
      'Léa Nguyen', 'Leïla Benali', 'Nicolas Dubois', 'Thomas Gagnon',
    ])
    expect(door.every((row) => !('email' in row))).toBe(true)
    expect(data.reservations).toEqual(original)
  })

  it('includes empty configured tables and every unassigned guest in kitchen totals', () => {
    const { kitchen } = buildServiceReports(createSeed())
    expect(kitchen).toHaveLength(5)
    expect(kitchen[0]).toEqual({ id: 'table-1', label: 'Table 1', guests: 0, arrived: 0, vegetarian: 0, glutenFree: 0 })
    expect(kitchen.at(-1)).toEqual({ id: null, label: 'Sans table', guests: 99, arrived: 0, vegetarian: 17, glutenFree: 6 })
    expect(kitchen.reduce((sum, row) => sum + row.guests, 0)).toBe(99)
  })

  it('counts planned diets separately from arrivals and retains overlapping requirements', () => {
    const data = createSeed()
    Object.assign(data.reservations[0], { tableId: 'table-3', arrivedAdults: 2, arrivedChildren: 1, vegetarian: 8, glutenFree: 8 })
    data.reservations[1].tableId = 'table-3'
    const { kitchen, door } = buildServiceReports(data)
    expect(kitchen[2]).toEqual({ id: 'table-3', label: 'Table 3', guests: 24, arrived: 3, vegetarian: 11, glutenFree: 8 })
    expect(kitchen.at(-1)?.guests).toBe(75)
    expect(kitchen.reduce((sum, row) => sum + row.guests, 0)).toBe(99)
    expect(kitchen.reduce((sum, row) => sum + row.arrived, 0)).toBe(3)
    expect(door.find((row) => row.name === 'Camille Roy')).toMatchObject({
      table: 'Table 3', arrivedAdults: 2, arrivedChildren: 1, dueCents: 0,
    })
  })

  it('uses reservation price snapshots rather than current prices for pending payments', () => {
    const data = createSeed()
    data.event.adultPriceCents = 9900
    data.event.childPriceCents = 4900
    expect(buildServiceReports(data).door.find((row) => row.name === 'Leïla Benali')).toMatchObject({
      paymentStatus: 'pending', dueCents: 17_400,
    })
  })

  it('reflects table renames without changing bookings or notes', () => {
    const data = createSeed()
    data.tables[1].label = 'Table du marché'
    data.reservations[1].tableId = 'table-2'
    const { door, kitchen } = buildServiceReports(data)
    expect(door.find((row) => row.name === 'Nicolas Dubois')).toMatchObject({
      table: 'Table du marché', note: 'Deux tables côte à côte, si possible.',
    })
    expect(kitchen[1]).toMatchObject({ label: 'Table du marché', guests: 16 })
  })

  it('handles a completely empty dinner with explicit zero totals', () => {
    const { door, kitchen } = buildServiceReports({ ...createSeed(), reservations: [], tables: [] })
    expect(door).toEqual([])
    expect(kitchen).toEqual([{ id: null, label: 'Sans table', guests: 0, arrived: 0, vegetarian: 0, glutenFree: 0 }])
  })

  it('does not hide a dangling table reference by treating it as unassigned', () => {
    const data = createSeed()
    data.reservations[0].tableId = 'missing'
    expect(() => buildServiceReports(data)).toThrow('Une réservation fait référence à une table absente.')
  })
})
