import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { summarize } from './domain'
import { server, store } from './test/server'

async function open(section?: string) {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: /Du bon spaghetti\.\s*Une bonne cause\./ })
  if (section) await user.click(screen.getByRole('button', { name: section }))
  return user
}

describe('organizer interface', () => {
  it('shows the actual seeded totals and clearly labels the mock backend', async () => {
    await open()
    expect(screen.getByText('99 / 180')).toBeInTheDocument()
    expect(screen.getByText('984,00 $')).toBeInTheDocument()
    expect(screen.getByText('620,00 $')).toBeInTheDocument()
    expect(screen.getByText('8 / 16')).toBeInTheDocument()
    expect(screen.getByText('Démo · backend simulé')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Objectif de collecte prévu' })).toHaveAttribute('aria-valuenow', '49')
  })

  it('adds a reservation through the API and updates the dashboard', async () => {
    const user = await open('Réservations')
    await user.type(screen.getByLabelText('Nom du contact'), 'Marie Demo')
    await user.type(screen.getByLabelText('Adresse courriel'), 'marie@example.test')
    await user.clear(screen.getByLabelText('Adultes'))
    await user.type(screen.getByLabelText('Adultes'), '2')
    await user.click(screen.getByRole('button', { name: 'Ajouter la réservation' }))
    await screen.findByText('Marie Demo')
    expect(store.read().reservations.at(-1)?.totalCents).toBe(3600)
    expect(screen.getByLabelText('Nom du contact')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Vue d’ensemble' }))
    expect(screen.getByText('101 / 180')).toBeInTheDocument()
  })

  it('searches names without requiring accents and filters payment status', async () => {
    const user = await open('Réservations')
    await user.type(screen.getByRole('searchbox'), 'emile')
    expect(screen.getByText('Émile Côté')).toBeInTheDocument()
    expect(screen.queryByText('Camille Roy')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'À encaisser' }))
    expect(screen.getByRole('heading', { name: 'Aucune réservation ici' })).toBeInTheDocument()
  })

  it('marks payment received and retains it across a component remount', async () => {
    const user = await open('Réservations')
    await user.click(screen.getByRole('button', { name: 'Marquer la réservation de Alice Moreau comme payée' }))
    await screen.findByRole('button', { name: 'Marquer la réservation de Alice Moreau en attente' })
    expect(summarize(store.read()).collectedCents).toBe(107600)
    cleanup()
    await open('Réservations')
    expect(screen.getByRole('button', { name: 'Marquer la réservation de Alice Moreau en attente' })).toBeInTheDocument()
  })

  it('only removes a reservation after confirmation', async () => {
    const user = await open('Réservations')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Supprimer la réservation de Camille Roy' }))
    expect(store.read().reservations).toHaveLength(8)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Supprimer la réservation de Camille Roy' }))
    await waitFor(() => expect(screen.queryByText('Camille Roy')).not.toBeInTheDocument())
    expect(summarize(store.read()).guests).toBe(91)
  })

  it('adds and removes a volunteer from a shift', async () => {
    const user = await open('Bénévoles')
    await user.type(screen.getByLabelText('Nom du bénévole'), 'Julie Demo')
    await user.click(screen.getByRole('button', { name: 'Inscrire le bénévole' }))
    await screen.findByText('Julie Demo')
    expect(store.read().volunteers).toHaveLength(9)
    await user.click(screen.getByRole('button', { name: 'Retirer Julie Demo du créneau En cuisine' }))
    await waitFor(() => expect(screen.queryByText('Julie Demo')).not.toBeInTheDocument())
    expect(store.read().volunteers).toHaveLength(8)
  })

  it('adds a budget item with exact cents and marks it purchased', async () => {
    const user = await open('Courses & budget')
    await user.type(screen.getByLabelText('Article ou dépense'), 'Jus de pommes')
    await user.type(screen.getByLabelText('Quantité ou détail'), '12 bouteilles')
    await user.type(screen.getByLabelText('Coût total prévu ($ CA)'), '16.50')
    await user.click(screen.getByRole('button', { name: 'Ajouter un achat' }))
    await screen.findByText('Jus de pommes')
    expect(summarize(store.read()).expenseCents).toBe(63650)
    const checkbox = screen.getByRole('checkbox', { name: 'Achat réalisé : Jus de pommes' })
    await user.click(checkbox)
    await waitFor(() => expect(checkbox).toBeChecked())
    expect(store.read().expenses.at(-1)?.purchased).toBe(true)
  })

  it('shows existing spending as over budget even when the spending limit is zero', async () => {
    const current = store.read()
    store.updateEvent({ ...current.event, budgetCents: 0 })
    await open('Courses & budget')
    expect(screen.getByText('620,00 $ de dépassement du budget')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Utilisation du budget de dépenses' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('saves event settings without repricing existing reservations', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Paramètres' }))
    await user.clear(screen.getByLabelText('Billet adulte ($ CA)'))
    await user.type(screen.getByLabelText('Billet adulte ($ CA)'), '20.00')
    await user.click(screen.getByRole('button', { name: 'Enregistrer les paramètres' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Paramètres de l’événement' })).not.toBeInTheDocument())
    expect(store.read().event.adultPriceCents).toBe(2000)
    expect(summarize(store.read()).pledgedCents).toBe(159800)
  })

  it('surfaces API failure, keeps the entered form, and does not claim success', async () => {
    const user = await open('Réservations')
    server.use(http.post('http://localhost/api/reservations', () => HttpResponse.json(
      { code: 'demo_failure', error: 'Échec simulé : réessayez.' }, { status: 503 },
    )))
    await user.type(screen.getByLabelText('Nom du contact'), 'Marie Demo')
    await user.type(screen.getByLabelText('Adresse courriel'), 'marie@example.test')
    await user.click(screen.getByRole('button', { name: 'Ajouter la réservation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Échec simulé : réessayez.')
    expect(screen.getByLabelText('Nom du contact')).toHaveValue('Marie Demo')
    expect(screen.queryByText('La réservation de Marie Demo a été ajoutée.')).not.toBeInTheDocument()
    expect(store.read().reservations).toHaveLength(8)
  })

  it('recovers from a load error by retrying', async () => {
    server.use(http.get('http://localhost/api/organizer', () => HttpResponse.json(
      { code: 'demo_failure', error: 'Chargement indisponible.' }, { status: 503 },
    ), { once: true }))
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Chargement indisponible.')
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    await screen.findByRole('heading', { name: /Du bon spaghetti\.\s*Une bonne cause\./ })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('resets modified demo data after confirmation', async () => {
    store.deleteReservation('reservation-1')
    const user = await open()
    expect(screen.getByText('91 / 180')).toBeInTheDocument()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }))
    await waitFor(() => expect(screen.getByText('99 / 180')).toBeInTheDocument())
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent('La démo a été réinitialisée.')
  })
})

describe('event-day interface', () => {
  it('opens from the dashboard with separate arrival and seating totals', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Préparer l’accueil et les tables/ }))
    expect(screen.getByRole('heading', { name: 'Jour J' })).toBeInTheDocument()
    expect(screen.getByText('Personnes accueillies').closest('article')).toHaveTextContent('0 / 99')
    expect(screen.getByText('Places attribuées').closest('article')).toHaveTextContent('0 / 99')
    expect(screen.getByText('Plan de tables').closest('article')).toHaveTextContent('4 tables')
    expect(screen.getByRole('region', { name: 'Fiche d’arrivée' })).toHaveTextContent('Choisissez un groupe')
  })

  it('records partial arrivals and retains them after a remount', async () => {
    const user = await open('Jour J')
    await user.click(screen.getByRole('button', { name: 'Accueillir Camille Roy' }))
    await user.clear(screen.getByLabelText('Adultes présents'))
    await user.type(screen.getByLabelText('Adultes présents'), '2')
    await user.clear(screen.getByLabelText('Enfants présents'))
    await user.type(screen.getByLabelText('Enfants présents'), '1')
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’arrivée' }))
    await screen.findByText('L’arrivée de Camille Roy a été mise à jour.')
    expect(store.read().reservations[0]).toMatchObject({ arrivedAdults: 2, arrivedChildren: 1 })
    expect(screen.getByText('Personnes accueillies').closest('article')).toHaveTextContent('3 / 99')
    cleanup()
    const remounted = await open('Jour J')
    await remounted.click(screen.getByRole('button', { name: 'Accueillir Camille Roy' }))
    expect(screen.getByLabelText('Adultes présents')).toHaveValue(2)
    expect(screen.getByLabelText('Enfants présents')).toHaveValue(1)
  })

  it('welcomes unpaid guests without recording a payment until explicitly requested', async () => {
    const user = await open('Jour J')
    await user.click(screen.getByRole('button', { name: 'Accueillir Leïla Benali' }))
    await user.click(screen.getByRole('button', { name: 'Accueillir tout le groupe' }))
    await screen.findByText('Tout le groupe de Leïla Benali a été accueilli.')
    expect(store.read().reservations[2]).toMatchObject({ arrivedAdults: 8, arrivedChildren: 3, paymentStatus: 'pending' })
    expect(screen.getByRole('button', { name: 'Accueillir tout le groupe' })).toBeDisabled()
    expect(summarize(store.read()).collectedCents).toBe(98_400)
    await user.click(screen.getByRole('button', { name: 'Marquer comme payé' }))
    await screen.findByText('Le paiement de Leïla Benali a été reçu.')
    expect(store.read().reservations[2].paymentStatus).toBe('paid')
    expect(summarize(store.read()).collectedCents).toBe(115_800)
  })

  it('confirms arrival corrections and preserves payment and table assignment', async () => {
    store.setTable('reservation-1', { tableId: 'table-1' })
    store.setArrival('reservation-1', { arrivedAdults: 6, arrivedChildren: 2 })
    const user = await open('Jour J')
    await user.click(screen.getByRole('button', { name: 'Accueillir Camille Roy' }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Remettre les arrivées à zéro' }))
    expect(store.read().reservations[0].arrivedAdults).toBe(6)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Remettre les arrivées à zéro' }))
    await screen.findByText('Les arrivées de Camille Roy ont été remises à zéro.')
    expect(store.read().reservations[0]).toMatchObject({
      arrivedAdults: 0, arrivedChildren: 0, paymentStatus: 'paid', tableId: 'table-1',
    })
  })

  it('searches without accents, filters partial arrivals, and announces empty results', async () => {
    store.setArrival('reservation-1', { arrivedAdults: 2, arrivedChildren: 0 })
    const user = await open('Jour J')
    const desk = within(screen.getByRole('region', { name: 'Accueil des invités' }))
    await user.click(desk.getByRole('button', { name: 'Partiels' }))
    expect(desk.getByRole('button', { name: 'Accueillir Camille Roy' })).toBeInTheDocument()
    expect(desk.queryByRole('button', { name: 'Accueillir Émile Côté' })).not.toBeInTheDocument()
    await user.type(desk.getByRole('searchbox'), 'emile')
    expect(desk.getByRole('status')).toHaveTextContent('0 groupe affiché.')
    await user.click(desk.getByRole('button', { name: 'Tous' }))
    expect(desk.getByRole('button', { name: 'Accueillir Émile Côté' })).toBeInTheDocument()
    expect(desk.queryByRole('button', { name: 'Accueillir Camille Roy' })).not.toBeInTheDocument()
  })

  it('assigns, moves, and unassigns an entire group without changing arrivals', async () => {
    const user = await open('Jour J')
    const selection = screen.getByRole('combobox', { name: 'Table pour Camille Roy' })
    await user.selectOptions(selection, 'table-1')
    await waitFor(() => expect(selection).toHaveValue('table-1'))
    expect(screen.getByRole('button', { name: 'Supprimer Table 1' })).toBeDisabled()
    const alice = within(screen.getByRole('combobox', { name: 'Table pour Alice Moreau' }))
    expect(alice.getByRole('option', { name: /^Table 1/ })).toBeDisabled()
    await user.selectOptions(selection, 'table-3')
    await waitFor(() => expect(selection).toHaveValue('table-3'))
    expect(screen.getByRole('button', { name: 'Supprimer Table 1' })).toBeEnabled()
    expect(screen.getByText('Places attribuées').closest('article')).toHaveTextContent('8 / 99')
    await user.selectOptions(selection, '')
    await waitFor(() => expect(selection).toHaveValue(''))
    expect(store.read().reservations[0]).toMatchObject({ tableId: null, arrivedAdults: 0, arrivedChildren: 0 })
  })

  it('keeps duplicate-table inputs for correction and clears the form after success', async () => {
    const user = await open('Jour J')
    const name = screen.getByLabelText('Nom de la nouvelle table')
    await user.type(name, 'TABLE 1')
    await user.click(screen.getByRole('button', { name: 'Ajouter la table' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Une table porte déjà ce nom.')
    expect(name).toHaveValue('TABLE 1')
    await user.clear(name)
    await user.type(name, 'Table des voisins')
    await user.click(screen.getByRole('button', { name: 'Ajouter la table' }))
    await screen.findByRole('article', { name: 'Table des voisins' })
    expect(name).toHaveValue('')
    expect(store.read().tables).toHaveLength(5)
  })

  it('renames and resizes a table without losing its groups', async () => {
    store.setTable('reservation-1', { tableId: 'table-1' })
    const user = await open('Jour J')
    await user.clear(screen.getByLabelText('Nom de Table 1'))
    await user.type(screen.getByLabelText('Nom de Table 1'), 'Table des voisins')
    await user.clear(screen.getByLabelText('Places à Table 1'))
    await user.type(screen.getByLabelText('Places à Table 1'), '10')
    await user.click(screen.getByRole('button', { name: 'Enregistrer Table 1' }))
    await screen.findByRole('article', { name: 'Table des voisins' })
    expect(store.read().tables[0]).toEqual({ id: 'table-1', label: 'Table des voisins', capacity: 10 })
    expect(store.read().reservations[0].tableId).toBe('table-1')
    expect(screen.getByRole('combobox', { name: 'Table pour Camille Roy' })).toHaveValue('table-1')
  })

  it('only deletes an empty table after confirmation', async () => {
    const user = await open('Jour J')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Supprimer Table 1' }))
    expect(store.read().tables).toHaveLength(4)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Supprimer Table 1' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Table 1' })).not.toBeInTheDocument())
    expect(store.read().tables).toHaveLength(3)
  })

  it('displays arrival failures without losing entered counts or claiming success', async () => {
    const user = await open('Jour J')
    await user.click(screen.getByRole('button', { name: 'Accueillir Camille Roy' }))
    server.use(http.put('http://localhost/api/reservations/reservation-1/arrival', () => HttpResponse.json(
      { code: 'demo_failure', error: 'L’accueil est indisponible.' }, { status: 503 },
    )))
    await user.clear(screen.getByLabelText('Adultes présents'))
    await user.type(screen.getByLabelText('Adultes présents'), '2')
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’arrivée' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('L’accueil est indisponible.')
    expect(screen.getByLabelText('Adultes présents')).toHaveValue(2)
    expect(store.read().reservations[0].arrivedAdults).toBe(0)
    expect(screen.queryByText('L’arrivée de Camille Roy a été mise à jour.')).not.toBeInTheDocument()
  })

  it('restores the existing assignment when the seating request fails', async () => {
    const user = await open('Jour J')
    server.use(http.patch('http://localhost/api/reservations/reservation-1/table', () => HttpResponse.json(
      { code: 'demo_failure', error: 'Le plan est indisponible.' }, { status: 503 },
    )))
    const selection = screen.getByRole('combobox', { name: 'Table pour Camille Roy' })
    await user.selectOptions(selection, 'table-1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Le plan est indisponible.')
    expect(selection).toHaveValue('')
    expect(store.read().reservations[0].tableId).toBeNull()
  })

  it('includes configured table capacity in the settings minimum', async () => {
    store.addTable({ label: 'Grande tablée', capacity: 108 })
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Paramètres' }))
    expect(screen.getByLabelText('Capacité de la salle')).toHaveAttribute('min', '180')
    expect(screen.getByText('Au moins 180 places pour les réservations et les tables configurées.')).toBeInTheDocument()
  })
})
