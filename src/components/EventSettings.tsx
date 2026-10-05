import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { api } from '../api'
import { toCents, type EventSettings as DinnerSettings, type Organizer } from '../domain'
import type { RunAction } from '../useOrganizer'
import { Field, PanelHeading } from './ui'

export function EventSettings({ data, busy, run, reportError, close }: {
  data: Organizer; busy: boolean; run: RunAction; reportError: (message: string) => void; close: () => void
}) {
  const [form, setForm] = useState({
    name: data.event.name, date: data.event.date, time: data.event.time,
    location: data.event.location, capacity: String(data.event.capacity),
    adultPrice: (data.event.adultPriceCents / 100).toFixed(2),
    childPrice: (data.event.childPriceCents / 100).toFixed(2),
    budget: (data.event.budgetCents / 100).toFixed(2),
    goal: (data.event.goalCents / 100).toFixed(2),
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let settings: DinnerSettings
    try {
      settings = {
        name: form.name, date: form.date, time: form.time, location: form.location,
        capacity: Number(form.capacity),
        adultPriceCents: toCents(form.adultPrice), childPriceCents: toCents(form.childPrice),
        budgetCents: toCents(form.budget), goalCents: toCents(form.goal),
      }
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Un montant est invalide.')
      return
    }
    if (await run(() => api.updateEvent(settings), 'Les paramètres du dîner ont été enregistrés.')) close()
  }

  return (
    <section className="panel settings-panel" aria-label="Paramètres de l’événement">
      <PanelHeading title="Les détails de notre soirée" description="Tout ce qu’il faut pour rassembler le quartier."><button className="icon-button" aria-label="Fermer les paramètres" disabled={busy} onClick={close}><X size={20} aria-hidden="true" /></button></PanelHeading>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="settings-grid">
            <Field label="Nom de l’événement"><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Lieu"><input required minLength={2} maxLength={160} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
            <Field label="Date du dîner"><input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
            <Field label="Heure"><input type="time" required value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></Field>
            <Field label="Capacité de la salle"><input type="number" required min={1} max={2000} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field>
            <Field label="Billet adulte ($ CA)"><input type="number" required min={0} max={1_000_000} step="0.01" value={form.adultPrice} onChange={(event) => setForm({ ...form, adultPrice: event.target.value })} /></Field>
            <Field label="Billet enfant ($ CA)"><input type="number" required min={0} max={1_000_000} step="0.01" value={form.childPrice} onChange={(event) => setForm({ ...form, childPrice: event.target.value })} /></Field>
            <Field label="Budget de dépenses ($ CA)"><input type="number" required min={0} max={1_000_000} step="0.01" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} /></Field>
            <Field label="Objectif net de collecte ($ CA)"><input type="number" required min="0.01" max={1_000_000} step="0.01" value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} /></Field>
          </div>
          <div className="settings-bottom"><p className="field-hint">Les nouveaux tarifs s’appliquent aux prochaines réservations. Les billets déjà vendus conservent leur prix.</p><button className="button primary" type="submit" disabled={busy}><Check size={17} aria-hidden="true" />Enregistrer les paramètres</button></div>
        </fieldset>
      </form>
    </section>
  )
}
