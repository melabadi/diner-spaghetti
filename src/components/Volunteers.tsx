import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, ChefHat, Clock3, HandHeart, Plus, Trash2, Users } from 'lucide-react'
import { api } from '../api'
import { summarize, type Organizer } from '../domain'
import type { RunAction } from '../useOrganizer'
import { Field, PanelHeading, Progress } from './ui'

export function Volunteers({ data, busy, run }: { data: Organizer; busy: boolean; run: RunAction }) {
  const [name, setName] = useState('')
  const [shiftId, setShiftId] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const refocusName = useRef(false)
  const summary = summarize(data)
  const filled = data.volunteers.length
  const open = data.shifts.filter((shift) => data.volunteers.filter((item) => item.shiftId === shift.id).length < shift.required)
  const selected = open.find((shift) => shift.id === shiftId)
  const remaining = selected ? selected.required - data.volunteers.filter((item) => item.shiftId === selected.id).length : 0

  // The fieldset is disabled while saving, which drops keyboard focus; bring it back once it is enabled again.
  useEffect(() => {
    if (!busy && refocusName.current) {
      refocusName.current = false
      nameInput.current?.focus()
    }
  }, [busy])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const fillsShift = remaining === 1
    refocusName.current = true
    if (await run(() => api.addVolunteer({ name, shiftId: selected.id }), `${name} rejoint le créneau « ${selected.label} »${fillsShift ? ', qui est maintenant complet' : ''}.`)) {
      setName('')
      if (fillsShift) setShiftId('')
    }
  }

  return (
    <div className="page-content">
      <div className="section-summary"><HandHeart size={18} aria-hidden="true" /><strong>{filled} place{filled > 1 ? 's' : ''} pourvue{filled > 1 ? 's' : ''}</strong><span>sur {summary.requiredVolunteers} · {summary.openShifts} à combler</span></div>
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
                <p className="field-hint">{assigned.length} / {shift.required} places pourvues</p>
                <ul className="volunteer-list">
                  {assigned.map((item) => <li key={item.id}><span className="person-avatar small">{item.name.slice(0, 1)}</span><span>{item.name}</span><button className="icon-button danger" aria-label={`Retirer ${item.name} du créneau ${shift.label}`} disabled={busy} onClick={() => {
                    if (window.confirm(`Retirer ${item.name} du créneau « ${shift.label} » ?`)) {
                      void run(() => api.deleteVolunteer(item.id), `${item.name} ne fait plus partie du créneau « ${shift.label} ».`)
                    }
                  }}><Trash2 size={14} aria-hidden="true" /></button></li>)}
                </ul>
                {!assigned.length && <p className="empty-copy muted">Une petite équipe à composer ensemble.</p>}
              </article>
            )
          })}
        </section>
        <section className="panel form-panel">
          <PanelHeading title="Inscrire un bénévole" description="Entrez un nom et choisissez un créneau. Le créneau reste sélectionné pour la personne suivante." />
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <Field label="Nom du bénévole"><input ref={nameInput} required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. : Julie Roy" autoComplete="name" /></Field>
              <Field label="Créneau" hint={selected ? `Il reste ${remaining} place${remaining > 1 ? 's' : ''} dans ce créneau.` : undefined}><select required value={selected?.id ?? ''} onChange={(event) => setShiftId(event.target.value)}>
                <option value="">{open.length ? 'Choisissez un créneau' : 'Tous les créneaux sont complets'}</option>
                {data.shifts.map((shift) => {
                  const full = !open.some((item) => item.id === shift.id)
                  return <option key={shift.id} value={shift.id} disabled={full}>{shift.label} · {shift.time}{full ? ' · complet' : ''}</option>
                })}
              </select></Field>
              <p className="form-info"><HandHeart size={20} aria-hidden="true" />Un même bénévole peut prendre plusieurs créneaux. Vérifiez avec lui que les horaires sont compatibles.</p>
              <button className="button primary full-width" type="submit" disabled={busy || !open.length}><Plus size={17} aria-hidden="true" />Inscrire le bénévole</button>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  )
}
