import { organizerSchema, type Organizer, type ReservationInput } from '../domain'

const reservations: ReservationInput[] = [
  { name: 'Camille Roy', email: 'camille@example.test', adults: 6, children: 2, vegetarian: 2, glutenFree: 1, paymentStatus: 'paid', note: '' },
  { name: 'Nicolas Dubois', email: 'nicolas@example.test', adults: 12, children: 4, vegetarian: 3, glutenFree: 0, paymentStatus: 'paid', note: 'Deux tables côte à côte, si possible.' },
  { name: 'Leïla Benali', email: 'leila@example.test', adults: 8, children: 3, vegetarian: 2, glutenFree: 1, paymentStatus: 'pending', note: '' },
  { name: 'Thomas Gagnon', email: 'thomas@example.test', adults: 10, children: 0, vegetarian: 1, glutenFree: 0, paymentStatus: 'paid', note: '' },
  { name: 'Alice Moreau', email: 'alice@example.test', adults: 4, children: 2, vegetarian: 0, glutenFree: 1, paymentStatus: 'pending', note: '' },
  { name: 'Émile Côté', email: 'emile@example.test', adults: 14, children: 4, vegetarian: 4, glutenFree: 1, paymentStatus: 'paid', note: '' },
  { name: 'Léa Nguyen', email: 'lea@example.test', adults: 6, children: 2, vegetarian: 1, glutenFree: 0, paymentStatus: 'paid', note: '' },
  { name: 'Collectif des voisins', email: 'voisins@example.test', adults: 16, children: 6, vegetarian: 4, glutenFree: 2, paymentStatus: 'pending', note: 'Arrivée vers 18 h 30.' },
]

export function createSeed(): Organizer {
  return organizerSchema.parse({
    schemaVersion: 1,
    event: {
      name: 'Dîner spaghetti',
      date: '2026-11-14',
      time: '18:00',
      location: 'Centre communautaire Saint-Henri, Montréal',
      capacity: 180,
      adultPriceCents: 1800,
      childPriceCents: 1000,
      budgetCents: 110_000,
      goalCents: 200_000,
    },
    reservations: reservations.map((item, index) => ({
      ...item,
      id: `reservation-${index + 1}`,
      totalCents: item.adults * 1800 + item.children * 1000,
      createdAt: `2026-10-0${Math.floor(index / 2) + 1}T14:00:00.000Z`,
      arrivedAdults: 0,
      arrivedChildren: 0,
      tableId: null,
    })),
    tables: [
      { id: 'table-1', label: 'Table 1', capacity: 8 },
      { id: 'table-2', label: 'Table 2', capacity: 16 },
      { id: 'table-3', label: 'Table 3', capacity: 24 },
      { id: 'table-4', label: 'Table 4', capacity: 24 },
    ],
    shifts: [
      { id: 'kitchen', label: 'En cuisine', time: '15 h 30 – 18 h', required: 4 },
      { id: 'welcome', label: 'Accueil & billets', time: '17 h 30 – 20 h', required: 3 },
      { id: 'service', label: 'Service aux tables', time: '18 h – 20 h 30', required: 6 },
      { id: 'cleanup', label: 'Rangement', time: '20 h 30 – 22 h', required: 3 },
    ],
    volunteers: [
      { id: 'volunteer-1', name: 'Sophie Tremblay', shiftId: 'kitchen' },
      { id: 'volunteer-2', name: 'Julien Martel', shiftId: 'kitchen' },
      { id: 'volunteer-3', name: 'Chloé Robert', shiftId: 'welcome' },
      { id: 'volunteer-4', name: 'Maxime Girard', shiftId: 'welcome' },
      { id: 'volunteer-5', name: 'Emma Fortin', shiftId: 'service' },
      { id: 'volunteer-6', name: 'Alex Bouchard', shiftId: 'service' },
      { id: 'volunteer-7', name: 'Zoé Pelletier', shiftId: 'service' },
      { id: 'volunteer-8', name: 'Samira Haddad', shiftId: 'cleanup' },
    ],
    expenses: [
      { id: 'expense-1', label: 'Spaghettis', quantity: '12 kg', amountCents: 4200, purchased: true },
      { id: 'expense-2', label: 'Sauce tomate', quantity: '18 litres', amountCents: 9600, purchased: false },
      { id: 'expense-3', label: 'Viande hachée', quantity: '10 kg', amountCents: 13_500, purchased: false },
      { id: 'expense-4', label: 'Options végé & sans gluten', quantity: 'Lot de menus adaptés', amountCents: 7400, purchased: false },
      { id: 'expense-5', label: 'Salade et pain', quantity: '180 portions', amountCents: 8800, purchased: true },
      { id: 'expense-6', label: 'Desserts', quantity: '180 portions', amountCents: 12_000, purchased: false },
      { id: 'expense-7', label: 'Vaisselle & nappes', quantity: '180 couverts', amountCents: 6500, purchased: true },
    ],
    updatedAt: '2026-10-04T14:00:00.000Z',
  })
}
