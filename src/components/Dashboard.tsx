import {
  ArrowRight, CalendarDays, Check, CircleDollarSign, Clock3, HandHeart,
  Heart, Leaf, MapPin, ShoppingBasket, Ticket, Users, WheatOff,
} from 'lucide-react'
import { formatDate, formatMoney, summarize, summarizeEventDay, type Organizer } from '../domain'
import { ActionLink, PanelHeading, Progress, StatCard } from './ui'

export type Section = 'overview' | 'reservations' | 'volunteers' | 'budget' | 'event-day'

function SpaghettiIllustration() {
  return (
    <svg className="spaghetti-illustration" viewBox="0 0 320 260" fill="none" aria-hidden="true">
      <circle cx="170" cy="137" r="109" fill="#F2C87B" fillOpacity=".13" />
      <circle cx="276" cy="53" r="5" fill="#F2C87B" />
      <path d="M48 80h16m-8-8v16M263 207h14m-7-7v14" stroke="#F2C87B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="166" cy="219" rx="100" ry="12" fill="#12362B" fillOpacity=".5" />
      <path d="M74 154c8 47 42 70 91 70s83-23 91-70" fill="#F8F3E9" />
      <path d="M91 176c17 24 39 34 72 34" stroke="#DDD4BE" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="165" cy="153" rx="96" ry="27" fill="#E6DCC7" />
      <ellipse cx="165" cy="148" rx="82" ry="25" fill="#B85B3E" />
      <g stroke="#F3C763" strokeWidth="5" strokeLinecap="round">
        <path d="M102 149c-8-18 43-27 47-11s-27 26-28 6 56-11 58 3" />
        <path d="M143 150c-13-17 10-26 22-18s-5 27 16 21 30-20 9-17" />
        <path d="M179 148c-3-20 48-20 42-3s-28 12-25-3M114 140c-9-5-7-13 9-13" />
        <path d="M207 142c-10-19-30-27-39-42s18-22 18-38" />
        <path d="M188 139c-16-29-36-27-39-46s11-20 19-30" />
      </g>
      <path d="m167 45 30 9m-18-17-13 40m24-37-12 41m24-37-12 41" stroke="#F8F3E9" strokeWidth="4" strokeLinecap="round" />
      <path d="m176 73-26 75" stroke="#F8F3E9" strokeWidth="7" strokeLinecap="round" />
      <path d="M222 143c-19 0-25-11-21-19 12 0 25 7 21 19Z" fill="#80A971" />
      <path d="M222 144c-4-16 5-26 16-26 6 15-1 25-16 26Z" fill="#A4C388" />
      <circle cx="135" cy="155" r="5" fill="#D76B47" />
      <circle cx="202" cy="156" r="4" fill="#D76B47" />
    </svg>
  )
}

export function Dashboard({ data, navigate }: { data: Organizer; navigate: (section: Section) => void }) {
  const summary = summarize(data)
  const eventDay = summarizeEventDay(data)
  const outstanding = data.reservations.filter((item) => item.paymentStatus === 'pending').length
  const toBuy = data.expenses.filter((item) => !item.purchased).length
  const recent = [...data.reservations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)
  const goalPercent = Math.max(0, Math.round(summary.projectedNetCents / data.event.goalCents * 100))

  return (
    <div className="page-content">
      <section className="event-hero">
        <div className="hero-copy">
          <span className="hero-label"><Heart size={14} aria-hidden="true" /> AU PROFIT DE NOTRE QUARTIER</span>
          <h2>Du bon spaghetti.<br /><span>Une bonne cause.</span></h2>
          <p>Une grande tablée, des voisins réunis et une soirée qui fait du bien.</p>
          <div className="hero-details">
            <span><CalendarDays size={16} aria-hidden="true" />{formatDate(data.event.date)} · {data.event.time.replace(':', ' h ')}</span>
            <span><MapPin size={16} aria-hidden="true" />{data.event.location}</span>
          </div>
        </div>
        <SpaghettiIllustration />
      </section>

      <div className="stats-grid">
        <StatCard icon={Ticket} label="Places réservées" value={`${summary.guests} / ${data.event.capacity}`} detail={`${summary.availableSeats} places encore disponibles`} tone="orange" />
        <StatCard icon={CircleDollarSign} label="Recettes encaissées" value={formatMoney(summary.collectedCents)} detail={`${formatMoney(summary.pendingCents)} à encaisser`} />
        <StatCard icon={ShoppingBasket} label="Dépenses prévues" value={formatMoney(summary.expenseCents)} detail={`Budget de ${formatMoney(data.event.budgetCents)}`} tone="blue" />
        <StatCard icon={HandHeart} label="Créneaux pourvus" value={`${data.volunteers.length} / ${summary.requiredVolunteers}`} detail={`${summary.openShifts} places bénévoles à combler`} tone="purple" />
      </div>

      <div className="dashboard-grid">
        <section className="panel goal-panel">
          <PanelHeading title="Chaque assiette compte" description="Notre objectif de collecte" />
          <div className="goal-amount">{formatMoney(summary.projectedNetCents)}<span>nets prévus</span></div>
          <Progress value={summary.projectedNetCents} max={data.event.goalCents} label="Objectif de collecte prévu" />
          <div className="progress-caption"><span>Objectif : {formatMoney(data.event.goalCents)}</span><strong>{goalPercent} %</strong></div>
          <div className="goal-note"><Heart size={18} aria-hidden="true" /><p>Les réservations, moins toutes les dépenses prévues. Le montant reste une projection, pas une somme déjà collectée.</p></div>
          <ActionLink onClick={() => navigate('budget')}>Voir le détail du budget</ActionLink>
        </section>

        <section className="panel next-panel">
          <PanelHeading title="Les prochains petits pas" description="Pour arriver au jour J l’esprit tranquille." />
          <button className="next-action" onClick={() => navigate('reservations')}>
            <span className="next-icon orange"><Ticket size={19} aria-hidden="true" /></span>
            <span><strong>{outstanding ? `${outstanding} réservations à encaisser` : 'Tous les billets sont payés'}</strong><small>{formatMoney(summary.pendingCents)} de paiements en attente</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button className="next-action" onClick={() => navigate('volunteers')}>
            <span className="next-icon purple"><Users size={19} aria-hidden="true" /></span>
            <span><strong>{summary.openShifts ? `${summary.openShifts} places bénévoles à combler` : 'L’équipe est au complet'}</strong><small>Cuisine, accueil, service et rangement</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button className="next-action" onClick={() => navigate('budget')}>
            <span className="next-icon blue"><ShoppingBasket size={19} aria-hidden="true" /></span>
            <span><strong>{toBuy ? `${toBuy} achats à préparer` : 'La liste de courses est prête'}</strong><small>Les ingrédients d’une soirée réussie</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button className="next-action" onClick={() => navigate('event-day')}>
            <span className="next-icon green"><Users size={19} aria-hidden="true" /></span>
            <span><strong>Préparer l’accueil et les tables</strong><small>{eventDay.arrivedGuests} / {eventDay.totalGuests} personnes accueillies · {eventDay.unassignedGuests} places à attribuer</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </section>

        <section className="panel">
          <PanelHeading title="Ils seront à table"><ActionLink onClick={() => navigate('reservations')}>Tout voir</ActionLink></PanelHeading>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((item) => (
                <div className="recent-row" key={item.id}>
                  <span className="person-avatar">{item.name.slice(0, 1)}</span>
                  <div><strong>{item.name}</strong><span className="muted">{item.adults + item.children} places · {formatMoney(item.totalCents)}</span></div>
                  <span className={`badge ${item.paymentStatus === 'paid' ? 'green' : 'orange'}`}>
                    {item.paymentStatus === 'paid' ? <Check size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
                    {item.paymentStatus === 'paid' ? 'Payé' : 'À encaisser'}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="muted empty-copy">Les premières réservations apparaîtront ici.</p>}
        </section>

        <section className="panel menu-panel">
          <PanelHeading title="Une place pour tout le monde" description="Les menus à prévoir en cuisine" />
          <div className="menu-counts">
            <div><span className="menu-icon green"><Leaf size={22} aria-hidden="true" /></span><strong>{summary.vegetarian}</strong><span>Végétariens</span></div>
            <div><span className="menu-icon orange"><WheatOff size={22} aria-hidden="true" /></span><strong>{summary.glutenFree}</strong><span>Sans gluten</span></div>
          </div>
          <p className="field-hint">Ces besoins peuvent se chevaucher. Confirmez les allergies et les précautions avec chaque contact avant le dîner.</p>
        </section>
      </div>
    </div>
  )
}
