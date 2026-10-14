import { reservationsByName, type Organizer } from './domain'

interface KitchenRow {
  id: string | null
  label: string
  guests: number
  arrived: number
  vegetarian: number
  glutenFree: number
}

function kitchenRow(id: string | null, label: string): KitchenRow {
  return { id, label, guests: 0, arrived: 0, vegetarian: 0, glutenFree: 0 }
}

export function buildServiceReports(data: Organizer) {
  const kitchen = [
    ...data.tables.map((table) => kitchenRow(table.id, table.label)),
    kitchenRow(null, 'Sans table'),
  ]
  const byTable = new Map(kitchen.map((row) => [row.id, row]))
  const door = reservationsByName(data.reservations).map((reservation) => {
    const row = byTable.get(reservation.tableId)
    if (!row) throw new Error('Une réservation fait référence à une table absente.')
    row.guests += reservation.adults + reservation.children
    row.arrived += reservation.arrivedAdults + reservation.arrivedChildren
    row.vegetarian += reservation.vegetarian
    row.glutenFree += reservation.glutenFree
    return {
      id: reservation.id,
      name: reservation.name,
      adults: reservation.adults,
      children: reservation.children,
      arrivedAdults: reservation.arrivedAdults,
      arrivedChildren: reservation.arrivedChildren,
      table: reservation.tableId === null ? 'À placer' : row.label,
      paymentStatus: reservation.paymentStatus,
      dueCents: reservation.paymentStatus === 'pending' ? reservation.totalCents : 0,
      note: reservation.note,
    }
  })
  return { door, kitchen }
}
