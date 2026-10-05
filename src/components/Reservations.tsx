import { useState, type FormEvent } from 'react'
import { Check, Clock3, Leaf, Plus, Search, Ticket, Trash2, WheatOff } from 'lucide-react'
import { api } from '../api'
import { formatMoney, normalizeText, summarize, type Organizer, type ReservationInput } from '../domain'
import type { RunAction } from '../useOrganizer'
import { EmptyState, Field, PanelHeading } from './ui'

const emptyForm = {
  name: '', email: '', adults: '1', children: '0', vegetarian: '0', glutenFree: '0',
  paymentStatus: 'pending' as ReservationInput['paymentStatus'], note: '',
}

export function Reservations({ data, busy, run }: { data: Organizer; busy: boolean; run: RunAction }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [form, setForm] = useState(emptyForm)
  const summary = summarize(data)
  const visible = data.reservations.filter((item) =>
    normalizeText(`${item.name} ${item.email}`).includes(normalizeText(query))
    && (filter === 'all' || item.paymentStatus === filter),
  )
  const guests = Number(form.adults) + Number(form.children)
  const total = Number(form.adults) * data.event.adultPriceCents + Number(form.children) * data.event.childPriceCents

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const success = await run(() => api.addReservation({
      ...form,
      adults: Number(form.adults), children: Number(form.children),
      vegetarian: Number(form.vegetarian), glutenFree: Number(form.glutenFree),
    }), `La réservation de ${form.name} a été ajoutée.`)
    if (success) setForm(emptyForm)
  }

  return (
    <div className="page-content">
      <div className="section-summary"><Ticket size={18} aria-hidden="true" /><strong>{summary.guests} places réservées</strong><span>sur {data.event.capacity} · {summary.availableSeats} encore disponibles</span></div>
      <div className="content-with-form">
        <section className="panel reservations-panel">
          <PanelHeading title="Autour de la table" description={`${data.reservations.length} réservations, de belles retrouvailles.`} />
          <div className="table-toolbar">
            <div className="search-field"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Rechercher une réservation" placeholder="Un nom, un courriel…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <div className="filter-buttons" aria-label="Filtrer par paiement">
              {([['all', 'Tous'], ['pending', 'À encaisser'], ['paid', 'Payés']] as const).map(([value, label]) => (
                <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
          </div>
          {visible.length ? (
            <div className="table-scroll">
              <table>
                <caption className="sr-only">Réservations au dîner spaghetti</caption>
                <thead><tr><th scope="col">Contact</th><th scope="col">Places</th><th scope="col">Menus adaptés</th><th scope="col">Montant</th><th scope="col">Paiement</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <th scope="row"><strong>{item.name}</strong><span className="cell-secondary">{item.email}</span>{item.note && <span className="reservation-note">{item.note}</span>}</th>
                      <td><strong>{item.adults + item.children}</strong><span className="cell-secondary">{item.adults} ad. · {item.children} enf.</span></td>
                      <td><div className="diet-tags">{item.vegetarian > 0 && <span><Leaf size={12} aria-hidden="true" />{item.vegetarian} végé</span>}{item.glutenFree > 0 && <span><WheatOff size={12} aria-hidden="true" />{item.glutenFree} SG</span>}{!item.vegetarian && !item.glutenFree && <span className="muted">—</span>}</div></td>
                      <td className="money-cell">{formatMoney(item.totalCents)}</td>
                      <td><button
                        className={`badge payment-button ${item.paymentStatus === 'paid' ? 'green' : 'orange'}`}
                        disabled={busy}
                        aria-label={`Marquer la réservation de ${item.name} ${item.paymentStatus === 'paid' ? 'en attente' : 'comme payée'}`}
                        onClick={() => void run(() => api.setPayment(item.id, item.paymentStatus === 'paid' ? 'pending' : 'paid'), 'Le paiement a été mis à jour.')}
                      >{item.paymentStatus === 'paid' ? <Check size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}{item.paymentStatus === 'paid' ? 'Payé' : 'À encaisser'}</button></td>
                      <td><button className="icon-button danger" disabled={busy} aria-label={`Supprimer la réservation de ${item.name}`} onClick={() => {
                        if (window.confirm(`Supprimer la réservation de ${item.name} et libérer ses ${item.adults + item.children} places ?`)) {
                          void run(() => api.deleteReservation(item.id), 'La réservation a été supprimée.')
                        }
                      }}><Trash2 size={16} aria-hidden="true" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={Ticket} title="Aucune réservation ici" description={query || filter !== 'all' ? 'Essayez un autre nom ou un autre filtre.' : 'Ajoutez les premiers invités avec le formulaire.'} />}
        </section>

        <section className="panel form-panel">
          <PanelHeading title="Inviter à la tablée" description="Une réservation, un petit pas de plus." />
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <Field label="Nom du contact"><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex. : Marie Gagnon" autoComplete="name" /></Field>
              <Field label="Adresse courriel"><input type="email" required maxLength={160} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="marie@example.test" autoComplete="email" /></Field>
              <div className="form-grid">
                <Field label="Adultes" hint={`${formatMoney(data.event.adultPriceCents)} / billet`}><input type="number" required min={0} max={summary.availableSeats} value={form.adults} onChange={(event) => setForm({ ...form, adults: event.target.value })} /></Field>
                <Field label="Enfants" hint={`${formatMoney(data.event.childPriceCents)} / billet`}><input type="number" required min={0} max={summary.availableSeats} value={form.children} onChange={(event) => setForm({ ...form, children: event.target.value })} /></Field>
                <Field label="Menus végétariens"><input type="number" required min={0} max={guests} value={form.vegetarian} onChange={(event) => setForm({ ...form, vegetarian: event.target.value })} /></Field>
                <Field label="Menus sans gluten"><input type="number" required min={0} max={guests} value={form.glutenFree} onChange={(event) => setForm({ ...form, glutenFree: event.target.value })} /></Field>
              </div>
              <p className="field-hint dietary-hint">Les besoins végé et sans gluten peuvent concerner les mêmes personnes.</p>
              <Field label="Statut du paiement"><select value={form.paymentStatus} onChange={(event) => {
                const value = event.target.value
                if (value === 'paid' || value === 'pending') setForm({ ...form, paymentStatus: value })
              }}><option value="pending">À encaisser</option><option value="paid">Payé</option></select></Field>
              <Field label="Un petit mot (facultatif)"><textarea rows={2} maxLength={240} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Allergies à confirmer, arrivée prévue…" /></Field>
              <div className="form-total"><span>{guests} billet{guests > 1 ? 's' : ''}</span><strong>{formatMoney(total)}</strong></div>
              {summary.availableSeats === 0 && <p className="inline-warning">Le dîner est complet. Libérez des places ou augmentez la capacité dans les paramètres.</p>}
              <button className="button primary full-width" type="submit" disabled={busy || summary.availableSeats === 0}><Plus size={17} aria-hidden="true" />Ajouter la réservation</button>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  )
}
