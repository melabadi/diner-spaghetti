import { CheckCircle2, Clock3, Ticket, Users } from 'lucide-react'
import { summarizeEventDay, type Organizer } from '../domain'
import type { RunAction } from '../useOrganizer'
import { ArrivalDesk } from './ArrivalDesk'
import { SeatingPlan } from './SeatingPlan'
import { StatCard } from './ui'

export function EventDay({ data, busy, run }: { data: Organizer; busy: boolean; run: RunAction }) {
  const summary = summarizeEventDay(data)
  return (
    <div className="page-content event-day-page">
      <div className="stats-grid event-day-summary">
        <StatCard icon={Users} label="Personnes accueillies" value={`${summary.arrivedGuests} / ${summary.totalGuests}`} detail={`${summary.waitingGuests} personnes encore attendues`} />
        <StatCard icon={CheckCircle2} label="Groupes au complet" value={`${summary.fullyArrivedReservations} / ${data.reservations.length}`} detail="Les arrivées partielles restent à compléter" tone="blue" />
        <StatCard icon={Ticket} label="Places attribuées" value={`${summary.assignedGuests} / ${summary.totalGuests}`} detail={`${summary.unassignedGuests} places à attribuer`} tone="orange" />
        <StatCard icon={Clock3} label="Plan de tables" value={`${data.tables.length} tables`} detail={`${summary.tableSeats} places sur ${data.event.capacity} dans la salle`} tone="purple" />
      </div>
      <p className="event-day-note">L’accueil, les paiements et les tables sont suivis séparément. Un groupe peut arriver en plusieurs fois; sa table réserve toujours toutes ses places.</p>
      <ArrivalDesk data={data} busy={busy} run={run} />
      <SeatingPlan data={data} busy={busy} run={run} />
    </div>
  )
}
