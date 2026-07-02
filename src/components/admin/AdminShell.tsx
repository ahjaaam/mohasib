"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, FileText, Gauge, Inbox, ListChecks, UserCog, Users } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: BarChart3 },
  { href: "/admin/kpis", label: "KPIs", icon: Gauge },
  { href: "/admin/comptes", label: "Comptes", icon: Users },
  { href: "/admin/responsables", label: "Collaborateurs", icon: UserCog },
  { href: "/admin/abonnements", label: "Abonnements", icon: CreditCard },
  { href: "/admin/demandes", label: "Demandes", icon: Inbox },
  { href: "/admin/liste-attente", label: "Liste d'attente", icon: ListChecks },
  { href: "/admin/leads", label: "Leads documents", icon: FileText },
];

export default function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#0D1526]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-[#0D1526] md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-[17px] font-bold text-white">Mohasib Admin</div>
          <div className="mt-1 text-[10px] text-white/35">Back office fondateur</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} className={`flex items-center gap-2.5 border-r-2 px-5 py-3 text-[12.5px] ${active ? "border-[#C8924A] bg-[#C8924A]/10 text-[#C8924A]" : "border-transparent text-white/50 hover:bg-white/5 hover:text-white"}`}><Icon size={15} />{label}</Link>;
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-[10px] text-white/35">{email}</div>
      </aside>
      <div className="md:ml-[220px]">
        <nav className="flex gap-1 overflow-x-auto bg-[#0D1526] p-2 md:hidden">
          {NAV.map(({ href, label }) => <Link key={href} href={href} className="whitespace-nowrap rounded px-3 py-2 text-[11px] text-white/70">{label}</Link>)}
        </nav>
        <main className="mx-auto max-w-[1500px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
