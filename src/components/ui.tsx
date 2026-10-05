import type { ReactNode } from 'react'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field-control">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = Math.max(0, Math.min(100, max > 0 ? Math.round(value / max * 100) : value > 0 ? 100 : 0))
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, detail, tone = 'green' }: {
  icon: LucideIcon; label: string; value: string; detail: string; tone?: 'green' | 'orange' | 'blue' | 'purple'
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={20} aria-hidden="true" /></div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-detail">{detail}</p>
    </article>
  )
}

export function PanelHeading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="panel-heading">
      <div><h2>{title}</h2>{description && <p className="muted">{description}</p>}</div>
      {children}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="empty-state">
      <Icon size={32} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

export function ActionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="text-button" onClick={onClick}>{children}<ArrowUpRight size={16} aria-hidden="true" /></button>
}
