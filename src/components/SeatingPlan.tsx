import { useState, type FormEvent } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { api } from '../api'
import {
  reservationsByName, summarizeEventDay, tableOccupancy,
  type DiningTable, type Organizer,
} from '../domain'
import type { RunAction } from '../useOrganizer'
import { Field, PanelHeading } from './ui'

function TableEditor({ table, data, busy, run }: {
  table: DiningTable; data: Organizer; busy: boolean; run: RunAction
}) {
  const [label, setLabel] = useState(table.label)
  const [capacity, setCapacity] = useState(String(table.capacity))
  const parties = reservationsByName(data.reservations.filter((item) => item.tableId === table.id))
  const occupied = tableOccupancy(data, table.id)
  const maximum = data.event.capacity - summarizeEventDay(data).tableSeats + table.capacity

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run(() => api.updateTable(table.id, { label, capacity: Number(capacity) }), `La table ${label} a été enregistrée.`)
  }

  return (
    <article className="table-card" aria-label={table.label}>
      <div className="table-card-top"><h3>{table.label}</h3><span className="badge green">{occupied} / {table.capacity} places</span></div>
      <p className="field-hint">{table.capacity - occupied} places libres pour des groupes entiers.</p>
      {parties.length > 0 && <ul className="table-guests">{parties.map((item) => <li key={item.id}>{item.name} · {item.adults + item.children} places</li>)}</ul>}
      <form aria-label={`Modifier ${table.label}`} onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <Field label={`Nom de ${table.label}`}><input required minLength={2} maxLength={60} value={label} onChange={(event) => setLabel(event.target.value)} /></Field>
          <Field label={`Places à ${table.label}`} hint={`Au moins ${Math.max(1, occupied)} et au plus ${maximum} places.`}><input type="number" required min={Math.max(1, occupied)} max={maximum} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
          <div className="table-card-actions">
            <button className="button secondary" type="submit"><Save size={14} aria-hidden="true" />Enregistrer {table.label}</button>
            <button className="icon-button danger" type="button" disabled={busy || occupied > 0} aria-label={`Supprimer ${table.label}`} onClick={() => {
              if (window.confirm(`Supprimer ${table.label} et ses ${table.capacity} places du plan ?`)) {
                void run(() => api.deleteTable(table.id), `La table ${table.label} a été supprimée.`)
              }
            }}><Trash2 size={16} aria-hidden="true" /></button>
          </div>
          {occupied > 0 && <p className="field-hint">Déplacez les groupes avant de supprimer cette table.</p>}
        </fieldset>
      </form>
    </article>
  )
}

function NewTable({ remaining, busy, run }: { remaining: number; busy: boolean; run: RunAction }) {
  const [label, setLabel] = useState('')
  const [capacity, setCapacity] = useState('8')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await run(() => api.addTable({ label, capacity: Number(capacity) }), `La table ${label} a été ajoutée.`)) {
      setLabel('')
      setCapacity('8')
    }
  }

  return (
    <article className="table-card">
      <h3>Ajouter une table</h3>
      <p className="field-hint">{remaining} places de la salle restent à répartir.</p>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy || remaining === 0}>
          <Field label="Nom de la nouvelle table"><input required minLength={2} maxLength={60} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex. : Table des voisins" /></Field>
          <Field label="Places à la nouvelle table"><input type="number" required min={1} max={remaining} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
          <button className="button primary full-width" type="submit"><Plus size={16} aria-hidden="true" />Ajouter la table</button>
        </fieldset>
        {remaining === 0 && <p className="field-hint">Toutes les places de la salle sont configurées. Réduisez une table ou augmentez la capacité dans les paramètres.</p>}
      </form>
    </article>
  )
}

export function SeatingPlan({ data, busy, run }: { data: Organizer; busy: boolean; run: RunAction }) {
  const summary = summarizeEventDay(data)
  const occupancy = new Map(data.tables.map((table) => [table.id, tableOccupancy(data, table.id)]))
  return (
    <section className="panel seating-plan" aria-label="Plan de tables">
      <PanelHeading title="Une place pour chaque groupe" description="Une réservation reste à la même table. Les places sont retenues même avant l’arrivée." />
      <div className="seating-grid">
        {data.tables.map((table) => <TableEditor key={`${table.id}:${table.label}:${table.capacity}`} table={table} data={data} busy={busy} run={run} />)}
        <NewTable remaining={data.event.capacity - summary.tableSeats} busy={busy} run={run} />
      </div>
      <h3 className="seating-heading">Placer les groupes</h3>
      {data.reservations.length ? <div className="table-scroll">
        <table>
          <caption className="sr-only">Attribution des groupes aux tables</caption>
          <thead><tr><th scope="col">Contact</th><th scope="col">Places réservées</th><th scope="col">Table attribuée</th></tr></thead>
          <tbody>{reservationsByName(data.reservations).map((item) => {
            const guests = item.adults + item.children
            return <tr key={item.id}>
              <th scope="row"><strong>{item.name}</strong></th>
              <td>{guests}</td>
              <td><select aria-label={`Table pour ${item.name}`} value={item.tableId ?? ''} disabled={busy} onChange={(event) => {
                const tableId = event.target.value || null
                void run(() => api.setTable(item.id, tableId), `La table de ${item.name} a été mise à jour.`)
              }}>
                <option value="">À placer</option>
                {data.tables.map((table) => {
                  const assigned = item.tableId === table.id
                  const available = table.capacity - (occupancy.get(table.id) ?? 0) + (assigned ? guests : 0)
                  return <option key={table.id} value={table.id} disabled={available < guests}>{table.label} · {assigned ? `${guests} places attribuées` : `${available} places libres`}</option>
                })}
              </select></td>
            </tr>
          })}</tbody>
        </table>
      </div> : <p className="field-hint" role="status">Ajoutez des réservations pour placer les premiers groupes.</p>}
    </section>
  )
}
