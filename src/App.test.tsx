import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { api } from './api'
import { summarize } from './domain'
import { store } from './test/server'

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

  it('keeps reservation controls in keyboard order in both directions', async () => {
    const user = await open('Réservations')
    const controls = [
      'Nom du contact', 'Adresse courriel', 'Adultes', 'Enfants',
      'Menus végétariens', 'Menus sans gluten', 'Statut du paiement',
      'Un petit mot (facultatif)',
    ].map((label) => screen.getByLabelText(label))

    await user.click(controls.at(-1)!)
    for (const control of controls.slice(0, -1).reverse()) {
      await user.tab({ shift: true })
      expect(control).toHaveFocus()
    }
    for (const control of controls.slice(1)) {
      await user.tab()
      expect(control).toHaveFocus()
    }
    await user.tab()
    expect(screen.getByRole('button', { name: 'Ajouter la réservation' })).toHaveFocus()
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
    vi.spyOn(api, 'addReservation').mockRejectedValueOnce(new Error('Échec simulé : réessayez.'))
    await user.type(screen.getByLabelText('Nom du contact'), 'Marie Demo')
    await user.type(screen.getByLabelText('Adresse courriel'), 'marie@example.test')
    await user.click(screen.getByRole('button', { name: 'Ajouter la réservation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Échec simulé : réessayez.')
    expect(screen.getByLabelText('Nom du contact')).toHaveValue('Marie Demo')
    expect(screen.queryByText('La réservation de Marie Demo a été ajoutée.')).not.toBeInTheDocument()
    expect(store.read().reservations).toHaveLength(8)
  })

  it('recovers from a load error by retrying', async () => {
    vi.spyOn(api, 'load').mockRejectedValueOnce(new Error('Chargement indisponible.'))
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
