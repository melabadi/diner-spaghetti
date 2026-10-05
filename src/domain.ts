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
export const reservationSchema = z.object({
  ...reservationFields,
  id: z.string().min(1),
  totalCents: z.number().int().min(0).max(200_000_000_000),
  createdAt: z.iso.datetime(),
}).strict().superRefine(checkMeals)

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
  updatedAt: z.iso.datetime(),
}).strict()

export type EventSettings = z.infer<typeof eventSchema>
export type ReservationInput = z.infer<typeof reservationInputSchema>
export type Reservation = z.infer<typeof reservationSchema>
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
