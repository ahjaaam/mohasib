export interface DashboardDeadline {
  id: string;
  title: string;
  date: string;
  link?: string;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDayOfMonth(day: number, from: Date) {
  const next = new Date(from.getFullYear(), from.getMonth(), day);
  return next <= from ? new Date(from.getFullYear(), from.getMonth() + 1, day) : next;
}

function nextLastDayOfMonth(from: Date) {
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  return next <= from ? new Date(from.getFullYear(), from.getMonth() + 2, 0) : next;
}

export function getDefaultDashboardDeadlines(now = new Date()): DashboardDeadline[] {
  const isSchedule = [
    { month: 2, day: 31, quarter: 1 },
    { month: 5, day: 30, quarter: 2 },
    { month: 8, day: 30, quarter: 3 },
    { month: 11, day: 31, quarter: 4 },
    { month: 14, day: 31, quarter: 1 },
  ];
  const nextIs = isSchedule.find(({ month, day }) => {
    const year = now.getFullYear() + (month >= 12 ? 1 : 0);
    return new Date(year, month % 12, day) > now;
  })!;

  let irDate = new Date(now.getFullYear(), 1, 28);
  if (irDate <= now) irDate = new Date(now.getFullYear() + 1, 1, 28);

  let professionalTaxDate = new Date(now.getFullYear(), 0, 31);
  if (professionalTaxDate <= now) professionalTaxDate = new Date(now.getFullYear() + 1, 0, 31);

  return [
    { id: "tva-mensuelle", title: "Déclaration TVA mensuelle", date: toDateInput(nextDayOfMonth(20, now)), link: "https://tax.gov.ma" },
    { id: "cnss", title: "Déclaration CNSS mensuelle", date: toDateInput(nextLastDayOfMonth(now)), link: "https://www.cnss.ma" },
    {
      id: "is-acompte",
      title: `Acompte IS — T${nextIs.quarter}`,
      date: toDateInput(new Date(now.getFullYear() + (nextIs.month >= 12 ? 1 : 0), nextIs.month % 12, nextIs.day)),
      link: "https://tax.gov.ma",
    },
    { id: "ir-annuel", title: "Déclaration IR annuelle", date: toDateInput(irDate), link: "https://tax.gov.ma" },
    { id: "taxe-pro", title: "Taxe professionnelle", date: toDateInput(professionalTaxDate), link: "https://tax.gov.ma" },
  ];
}

export function parseDeadlineDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
