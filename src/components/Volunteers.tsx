import { useState, type FormEvent } from 'react'
import { Check, ChefHat, Clock3, HandHeart, Plus, Trash2, Users } from 'lucide-react'
import { api } from '../api'
import { summarize, type Organizer } from '../domain'
import type { RunAction } from '../useOrganizer'
import { Field, PanelHeading, Progress } from './ui'

export function Volunteers({ data, busy, run }: { data: Organizer; busy: boolean; run: RunAction }) {
  const [name, setName] = useState('')
  const [shiftId, setShiftId] = useState('')
  const summary = summarize(data)
  const open = data.shifts.filter((shift) => data.volunteers.filter((item) => item.shiftId === shift.id).length < shift.required)
  const selected = shiftId || open[0]?.id || ''
  const selectedAvailable = open.some((shift) => shift.id === selected)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await run(() => api.addVolunteer({ name, shiftId: selected }), `${name} rejoint l’équipe !`)) {
      setName('')
      setShiftId('')
    }
  }

  return (
    <div className="page-content">
      <div className="section-summary"><HandHeart size={18} aria-hidden="true" /><strong>{data.volunteers.length} créneaux pourvus</strong><span>sur {summary.requiredVolunteers} · {summary.openShifts} places à combler</span></div>
      <div className="content-with-form">
        <section className="shift-grid" aria-label="Créneaux bénévoles">
          {data.shifts.map((shift) => {
            const assigned = data.volunteers.filter((item) => item.shiftId === shift.id)
            const full = assigned.length >= shift.required
            return (
              <article className="panel shift-card" key={shift.id}>
                <div className="shift-card-top"><span className={`stat-icon ${full ? 'green' : 'orange'}`}>{shift.id === 'kitchen' ? <ChefHat size={22} aria-hidden="true" /> : <Users size={22} aria-hidden="true" />}</span><span className={`badge ${full ? 'green' : 'orange'}`}>{full ? <Check size={13} aria-hidden="true" /> : null}{full ? 'Complet' : `${shift.required - assigned.length} à combler`}</span></div>
                <h2>{shift.label}</h2>
                <p className="shift-time"><Clock3 size={14} aria-hidden="true" />{shift.time}</p>
                <Progress value={assigned.length} max={shift.required} label={`Couverture : ${shift.label}`} />
                <p className="field-hint">{assigned.length} / {shift.required} inscriptions</p>
                <ul className="volunteer-list">
                  {assigned.map((item) => <li key={item.id}><span className="person-avatar small">{item.name.slice(0, 1)}</span><span>{item.name}</span><button className="icon-button danger" aria-label={`Retirer ${item.name} du créneau ${shift.label}`} disabled={busy} onClick={() => void run(() => api.deleteVolunteer(item.id), 'L’inscription bénévole a été retirée.')}><Trash2 size={14} aria-hidden="true" /></button></li>)}
                </ul>
                {!assigned.length && <p className="empty-copy muted">Une petite équipe à composer ensemble.</p>}
              </article>
            )
          })}
        </section>
        <section className="panel form-panel">
          <PanelHeading title="Un coup de main ?" description="Chacun apporte un peu de son temps." />
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <Field label="Nom du bénévole"><input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. : Julie Roy" autoComplete="name" /></Field>
              <Field label="Créneau"><select required value={selected} onChange={(event) => setShiftId(event.target.value)}>
                {!open.length && <option value="">Tous les créneaux sont couverts</option>}
                {data.shifts.map((shift) => <option key={shift.id} value={shift.id} disabled={!open.some((item) => item.id === shift.id)}>{shift.label} · {shift.time}</option>)}
              </select></Field>
              <p className="form-info"><HandHeart size={20} aria-hidden="true" />Un même bénévole peut prendre plusieurs créneaux. Vérifiez avec lui que les horaires sont compatibles.</p>
              <button className="button primary full-width" type="submit" disabled={busy || !selectedAvailable}><Plus size={17} aria-hidden="true" />Inscrire le bénévole</button>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  )
}
