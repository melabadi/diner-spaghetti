import { useState } from 'react'
import {
  AlertCircle, CheckCircle2, HandHeart, Heart, LayoutDashboard, LoaderCircle,
  RotateCcw, Settings2, ShoppingBasket, Ticket, UtensilsCrossed,
} from 'lucide-react'
import { api } from './api'
import { Budget } from './components/Budget'
import { Dashboard, type Section } from './components/Dashboard'
import { EventSettings } from './components/EventSettings'
import { Reservations } from './components/Reservations'
import { Volunteers } from './components/Volunteers'
import { useOrganizer } from './useOrganizer'
import './App.css'

const navigation = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'reservations', label: 'Réservations', icon: Ticket },
  { id: 'volunteers', label: 'Bénévoles', icon: HandHeart },
  { id: 'budget', label: 'Courses & budget', icon: ShoppingBasket },
] as const

const navPastaFacts = [
  'Le mot «\u00a0spaghetti\u00a0» vient de l’italien spago, qui signifie «\u00a0ficelle\u00a0».',
  'Il existe plusieurs centaines de formes de pâtes, chacune pensée pour retenir une sauce différente.',
  'Les pâtes al dente sont légèrement fermes sous la dent après la cuisson.',
  'En Italie, les pâtes sont traditionnellement servies comme primo, avant le plat principal.',
  'Les rainures des rigatoni aident les sauces épaisses à mieux adhérer aux pâtes.',
] as const

function App() {
  const [section, setSection] = useState<Section>('overview')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navPastaFact] = useState(() => navPastaFacts[Math.floor(Math.random() * navPastaFacts.length)])
  const { data, loading, busy, error, notice, run, reportError } = useOrganizer()

  function navigate(next: Section) {
    setSection(next)
    setSettingsOpen(false)
  }

  async function reset() {
    if (!window.confirm('Réinitialiser la démo ? Toutes les modifications locales seront remplacées par les données d’exemple.')) return
    if (await run(api.reset, 'La démo a été réinitialisée.')) {
      setSection('overview')
      setSettingsOpen(false)
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Aller au contenu</a>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><UtensilsCrossed size={25} aria-hidden="true" /></span><div><span className="brand-name">La tablée<span>.</span></span><span className="brand-subtitle">ON ORGANISE, ON PARTAGE.</span></div></div>
        <div className="sidebar-label">NOTRE SOIRÉE</div>
        <nav className="navigation" aria-label="Sections de l’organisateur">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} aria-hidden="true" /><span>{label}</span>{section === id && <span className="nav-dot" />}</button>)}
        </nav>
        <p className="nav-pasta-fact">{navPastaFact}</p>
        <div className="sidebar-bottom">
          <div className="community-note"><Heart size={23} aria-hidden="true" /><p>Les plus belles soirées<br />se préparent ensemble.</p></div>
          <div className="mock-badge"><span className="status-dot" /><div><strong>Démo · backend simulé</strong><span>Données dans ce navigateur</span></div></div>
        </div>
      </aside>

      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="topbar"><span>LE QUARTIER SE MET À TABLE</span><div className="team-label"><span>Équipe organisatrice</span><span className="team-avatar" aria-hidden="true">ÉO</span></div></div>
        <header className="page-header">
          <div><p className="eyebrow">UN PEU D’ORGANISATION, BEAUCOUP DE CONVIVIALITÉ</p><h1>{section === 'overview' ? data?.event.name || 'Dîner spaghetti' : navigation.find((item) => item.id === section)?.label}</h1><p className="muted">{section === 'overview' ? 'Tout est là pour préparer une soirée qui rassemble.' : section === 'reservations' ? 'Les invités, les billets et les petites attentions.' : section === 'volunteers' ? 'Une belle soirée, c’est d’abord une belle équipe.' : 'Des courses bien pensées, un budget bien suivi.'}</p></div>
          <div className="header-actions">
            <button className="button secondary reset-button" disabled={busy || loading} onClick={() => void reset()}><RotateCcw size={16} aria-hidden="true" />Réinitialiser</button>
            <button className="button secondary" disabled={!data || busy} aria-expanded={settingsOpen} aria-controls="event-settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={16} aria-hidden="true" />Paramètres</button>
          </div>
        </header>

        {error && <div className="feedback error" role="alert"><AlertCircle size={20} aria-hidden="true" /><span>{error}</span></div>}
        {notice && <div className="feedback success" role="status"><CheckCircle2 size={19} aria-hidden="true" /><span>{notice}</span></div>}
        {busy && <p className="saving-status" role="status"><LoaderCircle size={14} className="spin" aria-hidden="true" />Enregistrement en cours…</p>}

        {loading ? <div className="loading-state" role="status"><LoaderCircle size={28} className="spin" aria-hidden="true" /><p>On prépare la tablée…</p></div> : !data ? <section className="panel load-error"><h2>La démo n’a pas pu démarrer</h2><p>Réessayez le chargement ou réinitialisez les données locales avec le bouton en haut.</p><button className="button primary" disabled={busy} onClick={() => void run(api.load, 'Les données ont été chargées.')}>Réessayer</button></section> : <>
          {settingsOpen && <div id="event-settings"><EventSettings data={data} busy={busy} run={run} reportError={reportError} close={() => setSettingsOpen(false)} /></div>}
          {section === 'overview' && <Dashboard data={data} navigate={navigate} />}
          {section === 'reservations' && <Reservations data={data} busy={busy} run={run} />}
          {section === 'volunteers' && <Volunteers data={data} busy={busy} run={run} />}
          {section === 'budget' && <Budget data={data} busy={busy} run={run} reportError={reportError} />}
        </>}
        <footer className="page-footer"><span>Fait pour les grandes tablées et les bonnes causes.</span><span>Démo locale · Montants en dollars canadiens</span></footer>
      </main>
    </div>
  )
}

export default App
