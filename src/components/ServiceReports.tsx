import { useState } from 'react'
import { Printer } from 'lucide-react'
import { formatDate, formatMoney, summarize, summarizeEventDay, type Organizer } from '../domain'
import { buildServiceReports } from '../reports'
import { PanelHeading } from './ui'

export function ServiceReports({ data }: { data: Organizer }) {
  const [kind, setKind] = useState<'door' | 'kitchen'>('door')
  const reports = buildServiceReports(data)
  const summary = summarize(data)
  const eventDay = summarizeEventDay(data)
  const title = kind === 'door' ? 'Fiche d’accueil' : 'Fiche cuisine'
  const updated = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.updatedAt))

  return (
    <section className="panel service-reports" aria-label="Fiches de service">
      <div className="report-controls">
        <PanelHeading title="Fiches pour l’équipe" description="Un aperçu à jour, prêt pour la porte ou la cuisine." />
        <div className="table-toolbar">
          <div className="filter-buttons" role="group" aria-label="Choisir la fiche à imprimer">
            <button aria-pressed={kind === 'door'} onClick={() => setKind('door')}>Fiche d’accueil</button>
            <button aria-pressed={kind === 'kitchen'} onClick={() => setKind('kitchen')}>Fiche cuisine</button>
          </div>
          <button className="button secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Imprimer la fiche</button>
        </div>
        <p className="field-hint report-help">La fiche contient toutes les réservations, peu importe les filtres de l’accueil. Seule la fiche choisie est imprimée; aucun courriel n’est inclus.</p>
      </div>
      <div className="service-report" role="document" aria-label={title}>
        <header className="report-heading">
          <h2>{title}</h2>
          <h3>{data.event.name}</h3>
          <p>{formatDate(data.event.date)} · {data.event.time.replace(':', ' h ')}</p>
          <p>{data.event.location}</p>
          <p className="report-totals">{eventDay.totalGuests} invités · {eventDay.arrivedGuests} présents · {eventDay.unassignedGuests} places à attribuer</p>
        </header>
        {kind === 'door' ? reports.door.length ? <div className="table-scroll">
          <table className="report-table">
            <caption className="sr-only">Liste complète pour l’accueil</caption>
            <thead><tr><th scope="col">Contact</th><th scope="col">Billets réservés</th><th scope="col">Arrivées</th><th scope="col">Table</th><th scope="col">Paiement</th></tr></thead>
            <tbody>{reports.door.map((row) => <tr key={row.id}>
              <th scope="row"><strong>{row.name}</strong>{row.note && <span className="report-note">{row.note}</span>}</th>
              <td>{row.adults} ad. · {row.children} enf.</td>
              <td>{row.arrivedAdults} ad. · {row.arrivedChildren} enf.</td>
              <td>{row.table}</td>
              <td>{row.paymentStatus === 'paid' ? 'Payé' : `${formatMoney(row.dueCents)} à encaisser`}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p role="status">Aucune réservation à imprimer.</p> : <>
          <div className="table-scroll">
            <table className="report-table">
              <caption className="sr-only">Menus prévus par table, y compris les groupes sans table</caption>
              <thead><tr><th scope="col">Table</th><th scope="col">Invités prévus</th><th scope="col">Présents</th><th scope="col">Végétariens prévus</th><th scope="col">Sans gluten prévus</th></tr></thead>
              <tbody>{reports.kitchen.map((row) => <tr key={row.id === null ? 'unassigned' : `table:${row.id}`}>
                <th scope="row"><strong>{row.label}</strong></th><td>{row.guests}</td><td>{row.arrived}</td><td>{row.vegetarian}</td><td>{row.glutenFree}</td>
              </tr>)}</tbody>
              <tfoot><tr><th scope="row">Total</th><td>{summary.guests}</td><td>{eventDay.arrivedGuests}</td><td>{summary.vegetarian}</td><td>{summary.glutenFree}</td></tr></tfoot>
            </table>
          </div>
          <p className="field-hint report-caution">Les menus sont ceux de toutes les réservations, pas seulement des personnes arrivées. Les besoins végétariens et sans gluten peuvent se chevaucher; ne les additionnez pas pour déduire les menus standard. Confirmez les allergies et les précautions avec les contacts.</p>
          {reports.door.some((row) => row.note) && <div className="report-notes">
            <h3>Notes à confirmer avec les contacts</h3>
            <ul>{reports.door.filter((row) => row.note).map((row) => <li key={row.id}><strong>{row.name} · {row.table} :</strong> {row.note}</li>)}</ul>
          </div>}
        </>}
        <p className="field-hint report-updated">État local enregistré le {updated}. Démo locale, sans synchronisation avec d’autres appareils.</p>
      </div>
    </section>
  )
}
