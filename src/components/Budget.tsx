import { useState, type FormEvent } from 'react'
import { CircleDollarSign, Plus, Receipt, ShoppingBasket, Trash2, Wallet } from 'lucide-react'
import { api } from '../api'
import { formatMoney, summarize, toCents, type Organizer } from '../domain'
import type { RunAction } from '../useOrganizer'
import { EmptyState, Field, PanelHeading, Progress, StatCard } from './ui'

export function Budget({ data, busy, run, reportError }: {
  data: Organizer; busy: boolean; run: RunAction; reportError: (message: string) => void
}) {
  const [form, setForm] = useState({ label: '', quantity: '', amount: '' })
  const summary = summarize(data)
  const purchased = data.expenses.filter((item) => item.purchased).length

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let amountCents: number
    try {
      amountCents = toCents(form.amount)
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Le montant est invalide.')
      return
    }
    if (await run(() => api.addExpense({ label: form.label, quantity: form.quantity, amountCents }), 'L’achat a été ajouté à la liste.')) {
      setForm({ label: '', quantity: '', amount: '' })
    }
  }

  return (
    <div className="page-content">
      <div className="stats-grid budget-stats">
        <StatCard icon={CircleDollarSign} label="Recettes réservées" value={formatMoney(summary.pledgedCents)} detail={`${formatMoney(summary.collectedCents)} déjà encaissés`} />
        <StatCard icon={Receipt} label="Dépenses prévues" value={formatMoney(summary.expenseCents)} detail={`${formatMoney(summary.paidExpenseCents)} d’achats réalisés`} tone="blue" />
        <StatCard icon={Wallet} label="Bénéfice net prévu" value={formatMoney(summary.projectedNetCents)} detail="Réservations moins toutes les dépenses" tone="orange" />
        <StatCard icon={Wallet} label="Trésorerie nette" value={formatMoney(summary.cashNetCents)} detail="Paiements reçus moins achats réalisés" tone="purple" />
      </div>
      <section className={`budget-strip ${summary.budgetRemainingCents < 0 ? 'over-budget' : ''}`}>
        <div><strong>{summary.budgetRemainingCents >= 0 ? `${formatMoney(summary.budgetRemainingCents)} de marge sur le budget` : `${formatMoney(-summary.budgetRemainingCents)} de dépassement du budget`}</strong><p>Plafond de dépenses : {formatMoney(data.event.budgetCents)}</p></div>
        <Progress value={summary.expenseCents} max={data.event.budgetCents} label="Utilisation du budget de dépenses" />
      </section>
      <div className="content-with-form">
        <section className="panel">
          <PanelHeading title="La liste de courses" description="Cochez un achat une fois réalisé."><span className="badge green">{purchased} / {data.expenses.length} prêts</span></PanelHeading>
          {data.expenses.length ? <div className="shopping-list">
            {data.expenses.map((item) => <div className={`shopping-row ${item.purchased ? 'purchased' : ''}`} key={item.id}>
              <label className="shopping-check"><input type="checkbox" checked={item.purchased} disabled={busy} aria-label={`Achat réalisé : ${item.label}`} onChange={(event) => {
                const checked = event.target.checked
                void run(() => api.setPurchased(item.id, checked), 'La liste de courses a été mise à jour.')
              }} /><span><strong>{item.label}</strong><small>{item.quantity}</small></span></label>
              <strong className="money-cell">{formatMoney(item.amountCents)}</strong>
              <button className="icon-button danger" disabled={busy} aria-label={`Supprimer l’achat ${item.label}`} onClick={() => {
                if (window.confirm(`Supprimer « ${item.label} » de la liste de courses ?`)) void run(() => api.deleteExpense(item.id), 'L’achat a été supprimé.')
              }}><Trash2 size={16} aria-hidden="true" /></button>
            </div>)}
          </div> : <EmptyState icon={ShoppingBasket} title="Une liste à composer" description="Ajoutez les ingrédients et le matériel pour la soirée." />}
          <div className="shopping-total"><span>Total prévu</span><strong>{formatMoney(summary.expenseCents)}</strong></div>
        </section>
        <section className="panel form-panel">
          <PanelHeading title="Ne rien oublier" description="Un ingrédient, du matériel, une dépense." />
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <Field label="Article ou dépense"><input required minLength={2} maxLength={100} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Ex. : Jus de pommes" /></Field>
              <Field label="Quantité ou détail"><input required maxLength={60} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="Ex. : 12 bouteilles" /></Field>
              <Field label="Coût total prévu ($ CA)" hint="Pour toute la quantité, pas par unité."><input type="number" required min={0} max={1_000_000} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></Field>
              <button className="button primary full-width" type="submit" disabled={busy}><Plus size={17} aria-hidden="true" />Ajouter un achat</button>
            </fieldset>
          </form>
          <div className="form-info"><ShoppingBasket size={20} aria-hidden="true" /><p>Les montants sont des estimations saisies par l’équipe. Les quantités ne sont pas recalculées automatiquement avec les réservations.</p></div>
        </section>
      </div>
    </div>
  )
}
