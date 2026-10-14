import { useState, type FormEvent } from 'react'
import { CheckCircle2, Clock3, Search, Users } from 'lucide-react'
import { api } from '../api'
import {
  arrivalStatus, formatMoney, normalizeText, reservationsByName,
  type Organizer, type Reservation,
} from '../domain'
import type { RunAction } from '../useOrganizer'
import { EmptyState, Field, PanelHeading } from './ui'

const filters = [
  ['all', 'Tous'], ['waiting', 'À venir'], ['partial', 'Partiels'], ['arrived', 'Complets'],
] as const
const statusLabels = { waiting: 'À venir', partial: 'Partiel', arrived: 'Complet' }

function ArrivalForm({ reservation, busy, run }: {
  reservation: Reservation; busy: boolean; run: RunAction
}) {
  const [adults, setAdults] = useState(String(reservation.arrivedAdults))
  const [children, setChildren] = useState(String(reservation.arrivedChildren))
  const arrived = reservation.arrivedAdults + reservation.arrivedChildren
  const complete = arrivalStatus(reservation) === 'arrived'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run(() => api.setArrival(reservation.id, {
      arrivedAdults: Number(adults), arrivedChildren: Number(children),
    }), `L’arrivée de ${reservation.name} a été mise à jour.`)
  }

  return (
    <>
      <PanelHeading title={reservation.name} description={`${reservation.adults} adultes et ${reservation.children} enfants réservés.`} />
      {reservation.note && <p className="arrival-note">{reservation.note}</p>}
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <Field label="Adultes présents"><input type="number" required min={0} max={reservation.adults} value={adults} onChange={(event) => setAdults(event.target.value)} /></Field>
            <Field label="Enfants présents"><input type="number" required min={0} max={reservation.children} value={children} onChange={(event) => setChildren(event.target.value)} /></Field>
          </div>
          <p className="field-hint">Indiquez le total déjà arrivé, pas le nombre de nouvelles arrivées.</p>
          <div className="arrival-actions">
            <button className="button primary" type="submit"><CheckCircle2 size={16} aria-hidden="true" />Enregistrer l’arrivée</button>
            <button className="button secondary" type="button" disabled={busy || complete} onClick={() => void run(
              () => api.setArrival(reservation.id, { arrivedAdults: reservation.adults, arrivedChildren: reservation.children }),
              `Tout le groupe de ${reservation.name} a été accueilli.`,
            )}>Accueillir tout le groupe</button>
            <button className="button secondary" type="button" disabled={busy || arrived === 0} onClick={() => {
              if (window.confirm(`Remettre à zéro les arrivées de ${reservation.name} ? Le paiement et la table seront conservés.`)) {
                void run(() => api.setArrival(reservation.id, { arrivedAdults: 0, arrivedChildren: 0 }), `Les arrivées de ${reservation.name} ont été remises à zéro.`)
              }
            }}>Remettre les arrivées à zéro</button>
          </div>
        </fieldset>
      </form>
      <div className="arrival-payment">
        {reservation.paymentStatus === 'paid' ? <p className="badge green">Payé · {formatMoney(reservation.totalCents)}</p> : <>
          <p className="inline-warning">À encaisser : {formatMoney(reservation.totalCents)}. L’accueil ne valide pas le paiement.</p>
          <button className="button secondary" disabled={busy} onClick={() => void run(
            () => api.setPayment(reservation.id, 'paid'), `Le paiement de ${reservation.name} a été reçu.`,
          )}>Marquer comme payé</button>
        </>}
      </div>
    </>
  )
}

export function ArrivalDesk({ data, busy, run }: { data: Organizer; busy: boolean; run: RunAction }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<typeof filters[number][0]>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = data.reservations.find((item) => item.id === selectedId)
  const visible = reservationsByName(data.reservations).filter((item) =>
    normalizeText(`${item.name} ${item.email}`).includes(normalizeText(query))
    && (filter === 'all' || arrivalStatus(item) === filter),
  )

  return (
    <section className="arrival-desk" aria-label="Accueil des invités">
      <div className="content-with-form">
        <div className="panel">
          <PanelHeading title="À l’accueil" description="Retrouvez un groupe et notez ses arrivées, même en plusieurs fois." />
          <div className="table-toolbar">
            <div className="search-field"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Rechercher un groupe à l’accueil" placeholder="Un nom, un courriel…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <div className="filter-buttons arrival-filters" role="group" aria-label="Filtrer les arrivées">
              {filters.map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
            </div>
          </div>
          <p className="field-hint arrival-results" role="status">{visible.length} groupe{visible.length > 1 ? 's' : ''} affiché{visible.length > 1 ? 's' : ''}.</p>
          {visible.length ? <div className="table-scroll">
            <table className="arrival-table">
              <caption className="sr-only">Arrivées des groupes au dîner</caption>
              <thead><tr><th scope="col">Contact</th><th scope="col">Présences</th><th scope="col">Table</th><th scope="col">Accueil</th></tr></thead>
              <tbody>{visible.map((item) => {
                const status = arrivalStatus(item)
                return <tr key={item.id}>
                  <th scope="row"><strong>{item.name}</strong><span className="cell-secondary">{item.adults} ad. · {item.children} enf.</span></th>
                  <td><span className={`badge ${status === 'arrived' ? 'green' : status === 'partial' ? 'orange' : 'blue'}`}>{statusLabels[status]} · {item.arrivedAdults + item.arrivedChildren} / {item.adults + item.children}</span></td>
                  <td>{data.tables.find((table) => table.id === item.tableId)?.label ?? 'À placer'}</td>
                  <td><button className="button secondary" disabled={busy} aria-label={`Accueillir ${item.name}`} aria-controls="arrival-details" aria-expanded={selectedId === item.id} onClick={() => setSelectedId(item.id)}><Clock3 size={14} aria-hidden="true" />Accueillir</button></td>
                </tr>
              })}</tbody>
            </table>
          </div> : <EmptyState icon={Users} title="Aucun groupe à afficher" description="Essayez un autre nom ou un autre filtre d’arrivée." />}
        </div>
        <div id="arrival-details" className="panel" role="region" aria-label="Fiche d’arrivée">
          {selected ? <ArrivalForm key={`${selected.id}:${selected.arrivedAdults}:${selected.arrivedChildren}`} reservation={selected} busy={busy} run={run} /> : <EmptyState icon={Users} title="Choisissez un groupe" description="Le bouton Accueillir ouvre sa fiche, sans enregistrer d’arrivée." />}
        </div>
      </div>
    </section>
  )
}
