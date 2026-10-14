import { z } from 'zod'

const count = z.number().int('Utilisez un nombre entier.').min(0).max(2000)
const money = z.number().int('Le montant doit être en cents.').min(0).max(100_000_000)
const name = z.string().trim().min(2, 'Indiquez au moins deux caractères.').max(80)

export const eventSchema = z.object({
  name,
  date: z.iso.date('Indiquez une date valide.'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Indiquez une heure valide.'),
  location: z.string().trim().min(2).max(160),
  capacity: z.number().int().min(1).max(2000),
  adultPriceCents: money,
  childPriceCents: money,
  budgetCents: money,
  goalCents: money.min(1, 'L’objectif doit être supérieur à zéro.'),
}).strict()

export const paymentSchema = z.enum(['paid', 'pending'])

const reservationFields = {
  name,
  email: z.email('Indiquez une adresse courriel valide.').max(160),
  adults: count,
  children: count,
  vegetarian: count,
  glutenFree: count,
  paymentStatus: paymentSchema,
  note: z.string().trim().max(240),
}

function checkMeals(
  value: { adults: number; children: number; vegetarian: number; glutenFree: number },
  context: z.RefinementCtx,
) {
  const total = value.adults + value.children
  if (total === 0) {
    context.addIssue({ code: 'custom', path: ['adults'], message: 'Réservez au moins une place.' })
  }
  for (const field of ['vegetarian', 'glutenFree'] as const) {
    if (value[field] > total) {
      context.addIssue({
        code: 'custom', path: [field],
        message: 'Le nombre de menus ne peut pas dépasser le nombre de places.',
      })
    }
  }
}

export const reservationInputSchema = z.object(reservationFields).strict().superRefine(checkMeals)
export const arrivalInputSchema = z.object({
  arrivedAdults: count,
  arrivedChildren: count,
}).strict()
export const seatingInputSchema = z.object({
  tableId: z.string().min(1).nullable(),
}).strict()
export const reservationSchema = z.object({
  ...reservationFields,
  id: z.string().min(1),
  totalCents: z.number().int().min(0).max(200_000_000_000),
  createdAt: z.iso.datetime(),
  arrivedAdults: count.default(0),
  arrivedChildren: count.default(0),
  tableId: seatingInputSchema.shape.tableId.default(null),
}).strict().superRefine((value, context) => {
  checkMeals(value, context)
  for (const [arrived, reserved] of [['arrivedAdults', 'adults'], ['arrivedChildren', 'children']] as const) {
    if (value[arrived] > value[reserved]) {
      context.addIssue({
        code: 'custom', path: [arrived],
        message: 'Les arrivées ne peuvent pas dépasser les billets réservés.',
      })
    }
  }
})

export const tableInputSchema = z.object({
  label: z.string().trim().min(2, 'Nommez la table avec au moins deux caractères.').max(60),
  capacity: z.number().int('Utilisez un nombre entier.').min(1).max(2000),
}).strict()
export const tableSchema = tableInputSchema.extend({ id: z.string().min(1) })

export const shiftSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  time: z.string().min(1),
  required: z.number().int().min(1).max(100),
}).strict()

export const volunteerInputSchema = z.object({
  name,
  shiftId: z.string().min(1, 'Choisissez un créneau.'),
}).strict()
export const volunteerSchema = volunteerInputSchema.extend({ id: z.string().min(1) })

export const expenseInputSchema = z.object({
  label: z.string().trim().min(2).max(100),
  quantity: z.string().trim().min(1).max(60),
  amountCents: money,
}).strict()
export const expenseSchema = expenseInputSchema.extend({
  id: z.string().min(1),
  purchased: z.boolean(),
})

export const organizerSchema = z.object({
  schemaVersion: z.literal(1),
  event: eventSchema,
  reservations: z.array(reservationSchema),
  shifts: z.array(shiftSchema),
  volunteers: z.array(volunteerSchema),
  expenses: z.array(expenseSchema),
  tables: z.array(tableSchema).default([]),
  updatedAt: z.iso.datetime(),
}).strict().superRefine((data, context) => {
  const ids = new Set<string>()
  const labels = new Set<string>()
  const occupancy = new Map<string, number>()
  data.tables.forEach((table, index) => {
    if (ids.has(table.id) || labels.has(normalizeText(table.label))) {
      context.addIssue({
        code: 'custom', path: ['tables', index],
        message: 'Chaque table doit avoir un identifiant et un nom uniques.',
      })
    }
    ids.add(table.id)
    labels.add(normalizeText(table.label))
  })
  data.reservations.forEach((reservation, index) => {
    if (reservation.tableId === null) return
    if (!ids.has(reservation.tableId)) {
      context.addIssue({
        code: 'custom', path: ['reservations', index, 'tableId'],
        message: 'La table attribuée n’existe pas.',
      })
    }
    occupancy.set(reservation.tableId, (occupancy.get(reservation.tableId) ?? 0) + reservation.adults + reservation.children)
  })
  data.tables.forEach((table, index) => {
    if ((occupancy.get(table.id) ?? 0) > table.capacity) {
      context.addIssue({
        code: 'custom', path: ['tables', index, 'capacity'],
        message: 'Une table ne peut pas accueillir plus de places que sa capacité.',
      })
    }
  })
  if (data.tables.reduce((sum, table) => sum + table.capacity, 0) > data.event.capacity) {
    context.addIssue({
      code: 'custom', path: ['tables'],
      message: 'Les places aux tables ne peuvent pas dépasser la capacité de la salle.',
    })
  }
})

export type EventSettings = z.infer<typeof eventSchema>
export type ReservationInput = z.infer<typeof reservationInputSchema>
export type Reservation = z.infer<typeof reservationSchema>
export type ArrivalInput = z.infer<typeof arrivalInputSchema>
export type TableInput = z.infer<typeof tableInputSchema>
export type DiningTable = z.infer<typeof tableSchema>
export type VolunteerInput = z.infer<typeof volunteerInputSchema>
export type ExpenseInput = z.infer<typeof expenseInputSchema>
export type Organizer = z.infer<typeof organizerSchema>

export function summarize(data: Organizer) {
  const guests = data.reservations.reduce((sum, item) => sum + item.adults + item.children, 0)
  const pledgedCents = data.reservations.reduce((sum, item) => sum + item.totalCents, 0)
  const collectedCents = data.reservations
    .filter((item) => item.paymentStatus === 'paid')
    .reduce((sum, item) => sum + item.totalCents, 0)
  const expenseCents = data.expenses.reduce((sum, item) => sum + item.amountCents, 0)
  const paidExpenseCents = data.expenses.filter((item) => item.purchased)
    .reduce((sum, item) => sum + item.amountCents, 0)
  const requiredVolunteers = data.shifts.reduce((sum, shift) => sum + shift.required, 0)

  return {
    guests,
    availableSeats: data.event.capacity - guests,
    pledgedCents,
    collectedCents,
    pendingCents: pledgedCents - collectedCents,
    expenseCents,
    paidExpenseCents,
    projectedNetCents: pledgedCents - expenseCents,
    cashNetCents: collectedCents - paidExpenseCents,
    budgetRemainingCents: data.event.budgetCents - expenseCents,
    requiredVolunteers,
    openShifts: requiredVolunteers - data.volunteers.length,
    vegetarian: data.reservations.reduce((sum, item) => sum + item.vegetarian, 0),
    glutenFree: data.reservations.reduce((sum, item) => sum + item.glutenFree, 0),
  }
}

export function arrivalStatus(reservation: Reservation): 'waiting' | 'partial' | 'arrived' {
  const arrived = reservation.arrivedAdults + reservation.arrivedChildren
  if (arrived === 0) return 'waiting'
  return arrived === reservation.adults + reservation.children ? 'arrived' : 'partial'
}

export function tableOccupancy(data: Organizer, tableId: string) {
  return data.reservations.filter((item) => item.tableId === tableId)
    .reduce((sum, item) => sum + item.adults + item.children, 0)
}

export function summarizeEventDay(data: Organizer) {
  const totalGuests = summarize(data).guests
  const arrivedGuests = data.reservations.reduce((sum, item) => sum + item.arrivedAdults + item.arrivedChildren, 0)
  const assignedGuests = data.reservations.filter((item) => item.tableId !== null)
    .reduce((sum, item) => sum + item.adults + item.children, 0)
  return {
    totalGuests,
    arrivedGuests,
    waitingGuests: totalGuests - arrivedGuests,
    fullyArrivedReservations: data.reservations.filter((item) => arrivalStatus(item) === 'arrived').length,
    assignedGuests,
    unassignedGuests: totalGuests - assignedGuests,
    tableSeats: data.tables.reduce((sum, table) => sum + table.capacity, 0),
  }
}

export function reservationsByName(reservations: readonly Reservation[]) {
  return [...reservations].sort((a, b) => a.name.localeCompare(b.name, 'fr-CA'))
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100)
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'full' }).format(new Date(`${date}T12:00:00`))
}

export function toCents(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) {
    throw new Error('Indiquez un montant positif avec au plus deux décimales.')
  }
  const cents = Math.round(Number(value.trim().replace(',', '.')) * 100)
  if (!Number.isSafeInteger(cents) || cents > 100_000_000) {
    throw new Error('Le montant est trop élevé.')
  }
  return cents
}

export function normalizeText(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-CA').trim()
}
