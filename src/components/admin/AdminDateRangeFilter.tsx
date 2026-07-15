import type { AdminDateRange } from "@/lib/admin-date-range";

export function AdminDateRangeFilter({ range, className = "" }: { range: AdminDateRange; className?: string }) {
  return (
    <div className={`grid gap-2 sm:grid-cols-[minmax(150px,1fr)_minmax(135px,1fr)_minmax(135px,1fr)] ${className}`}>
      <select name="range" defaultValue={range.preset} className="input text-xs">
        <option value="day">Aujourd’hui</option>
        <option value="week">7 derniers jours</option>
        <option value="month">Ce mois</option>
        <option value="all">Toutes les périodes</option>
        <option value="custom">Période personnalisée</option>
      </select>
      <input name="from" type="date" defaultValue={range.fromInput} aria-label="Date de début" className="input text-xs" />
      <input name="to" type="date" defaultValue={range.toInput} aria-label="Date de fin" className="input text-xs" />
    </div>
  );
}
