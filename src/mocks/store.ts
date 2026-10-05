import { z } from 'zod'
import {
  eventSchema, expenseInputSchema, normalizeText, organizerSchema, paymentSchema,
  reservationInputSchema, summarize, volunteerInputSchema, type Organizer,
} from '../domain'
import { createSeed } from './seed'

export const STORAGE_KEY = 'la-tablee.organizer.v1'

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.status = status
    this.code = code
  }
}

export class OrganizerStore {
  private readonly storage: StorageAdapter

  constructor(storage: StorageAdapter) {
    this.storage = storage
  }

  read(): Organizer {
    let raw: string | null
    try {
      raw = this.storage.getItem(STORAGE_KEY)
    } catch (error) {
      throw new ApiError(500, 'storage_unavailable', 'Le stockage local est inaccessible. Autorisez-le dans votre navigateur.', { cause: error })
    }
    if (raw === null) return this.save(createSeed())

    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch (error) {
      throw new ApiError(500, 'storage_corrupt', 'Les données locales sont illisibles. Réinitialisez la démo pour repartir.', { cause: error })
    }
    const result = organizerSchema.safeParse(value)
    if (!result.success) {
      throw new ApiError(500, 'storage_corrupt', 'Les données locales sont incompatibles. Réinitialisez la démo pour repartir.', { cause: result.error })
    }
    return result.data
  }

  reset() {
    return this.save(createSeed())
  }

  updateEvent(input: unknown) {
    const event = eventSchema.parse(input)
    return this.update((data) => {
      if (event.capacity < summarize(data).guests) {
        throw new ApiError(409, 'capacity_conflict', 'La capacité ne peut pas être inférieure au nombre de places déjà réservées.')
      }
      data.event = event
    })
  }

  addReservation(input: unknown) {
    const reservation = reservationInputSchema.parse(input)
    return this.update((data) => {
      const remaining = summarize(data).availableSeats
      if (reservation.adults + reservation.children > remaining) {
        throw new ApiError(409, 'sold_out', `Il ne reste que ${remaining} place${remaining > 1 ? 's' : ''}.`)
      }
      data.reservations.push({
        ...reservation,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        // Existing reservations retain their sale price when event prices change.
        totalCents: reservation.adults * data.event.adultPriceCents + reservation.children * data.event.childPriceCents,
      })
    })
  }

  setPayment(id: string, input: unknown) {
    const { paymentStatus } = z.object({ paymentStatus: paymentSchema }).strict().parse(input)
    return this.update((data) => {
      const reservation = data.reservations.find((item) => item.id === id)
      if (!reservation) throw new ApiError(404, 'not_found', 'Cette réservation n’existe plus.')
      reservation.paymentStatus = paymentStatus
    })
  }

  deleteReservation(id: string) {
    return this.update((data) => {
      const index = data.reservations.findIndex((item) => item.id === id)
      if (index < 0) throw new ApiError(404, 'not_found', 'Cette réservation n’existe plus.')
      data.reservations.splice(index, 1)
    })
  }

  addVolunteer(input: unknown) {
    const volunteer = volunteerInputSchema.parse(input)
    return this.update((data) => {
      const shift = data.shifts.find((item) => item.id === volunteer.shiftId)
      if (!shift) throw new ApiError(404, 'not_found', 'Ce créneau n’existe pas.')
      const assigned = data.volunteers.filter((item) => item.shiftId === shift.id)
      if (assigned.some((item) => normalizeText(item.name) === normalizeText(volunteer.name))) {
        throw new ApiError(409, 'duplicate_volunteer', 'Cette personne est déjà inscrite à ce créneau.')
      }
      if (assigned.length >= shift.required) {
        throw new ApiError(409, 'shift_full', 'Ce créneau est déjà complet.')
      }
      data.volunteers.push({ ...volunteer, id: crypto.randomUUID() })
    })
  }

  deleteVolunteer(id: string) {
    return this.update((data) => {
      const index = data.volunteers.findIndex((item) => item.id === id)
      if (index < 0) throw new ApiError(404, 'not_found', 'Cette inscription n’existe plus.')
      data.volunteers.splice(index, 1)
    })
  }

  addExpense(input: unknown) {
    const expense = expenseInputSchema.parse(input)
    return this.update((data) => {
      data.expenses.push({ ...expense, id: crypto.randomUUID(), purchased: false })
    })
  }

  setPurchased(id: string, input: unknown) {
    const { purchased } = z.object({ purchased: z.boolean() }).strict().parse(input)
    return this.update((data) => {
      const expense = data.expenses.find((item) => item.id === id)
      if (!expense) throw new ApiError(404, 'not_found', 'Cet achat n’existe plus.')
      expense.purchased = purchased
    })
  }

  deleteExpense(id: string) {
    return this.update((data) => {
      const index = data.expenses.findIndex((item) => item.id === id)
      if (index < 0) throw new ApiError(404, 'not_found', 'Cet achat n’existe plus.')
      data.expenses.splice(index, 1)
    })
  }

  private update(change: (data: Organizer) => void) {
    const data = this.read()
    change(data)
    return this.save(data)
  }

  private save(data: Organizer) {
    const next = organizerSchema.parse({ ...data, updatedAt: new Date().toISOString() })
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      throw new ApiError(500, 'storage_write_failed', 'Impossible d’enregistrer vos changements. Vérifiez l’espace de stockage du navigateur.', { cause: error })
    }
    return next
  }
}
