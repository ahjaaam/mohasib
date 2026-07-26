"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { appUrl } from "@/lib/public-urls";

export type SimulatorKind = "tva" | "is" | "paie" | "rentabilite";

function mad(value: number) {
  return `${Math.round(value).toLocaleString("fr-MA")} MAD`;
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max?: number }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[#374151]">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-1.5 w-full rounded-lg border border-[rgba(13,21,38,0.12)] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#A89596]"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[#374151]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[rgba(13,21,38,0.12)] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#A89596]"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ResultRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-[#6B7280]">{label}</span>
      <span className={muted ? "font-semibold text-[#DC2626]" : "font-semibold text-[#0D1526]"}>{value}</span>
    </div>
  );
}

function ToolPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="public-surface public-accent-surface mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="public-icon-tile h-10 w-10">
          <Calculator size={20} />
        </div>
        <h2 className="text-[18px] font-bold text-[#0D1526]">{title}</h2>
      </div>
      {children}
      <Link href={appUrl("/inscription")} className="public-secondary-action mt-6 flex w-full">
        Calculer avec mes vraies donnees -&gt;
      </Link>
    </section>
  );
}

function nextDeadline() {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth() + 1, 20);
  return `20 ${date.toLocaleDateString("fr-FR", { month: "long" })}`;
}

function calcProgressiveIS(profit: number) {
  if (profit <= 300000) return profit * 0.175;
  if (profit <= 1000000) return 300000 * 0.175 + (profit - 300000) * 0.2;
  if (profit <= 100000000) return 300000 * 0.175 + 700000 * 0.2 + (profit - 1000000) * 0.2275;
  return 300000 * 0.175 + 700000 * 0.2 + 99000000 * 0.2275 + (profit - 100000000) * 0.34;
}

function calcIR(netImposable: number, married: boolean, children: number) {
  const annual = netImposable * 12;
  const brackets = [
    { max: 30000, rate: 0, deduction: 0 },
    { max: 50000, rate: 0.1, deduction: 3000 },
    { max: 60000, rate: 0.2, deduction: 8000 },
    { max: 80000, rate: 0.3, deduction: 14000 },
    { max: 180000, rate: 0.34, deduction: 17200 },
    { max: Infinity, rate: 0.38, deduction: 24400 },
  ];
  const bracket = brackets.find((item) => annual <= item.max) ?? brackets[0];
  const familyDeduction = (married ? 360 : 0) + Math.min(children, 6) * 360;
  return Math.max(0, (annual * bracket.rate - bracket.deduction - familyDeduction) / 12);
}

function TvaSimulator() {
  const [tvaCA, setTvaCA] = useState(100000);
  const [tvaRate, setTvaRate] = useState("20");
  const [tvaDeductible, setTvaDeductible] = useState(6000);
  const [tvaRegime, setTvaRegime] = useState("Mensuel");

  const tva = useMemo(() => {
    const collected = tvaCA * (Number(tvaRate) / 100);
    return { collected, due: Math.max(0, collected - tvaDeductible) };
  }, [tvaCA, tvaRate, tvaDeductible]);

  return (
    <ToolPanel title="Simulateur TVA">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField label="CA HT (MAD)" value={tvaCA} onChange={setTvaCA} />
        <SelectField label="Taux TVA" value={tvaRate} onChange={setTvaRate} options={["7", "10", "14", "20"]} />
        <NumberField label="TVA deductible achats (MAD)" value={tvaDeductible} onChange={setTvaDeductible} />
        <SelectField label="Regime" value={tvaRegime} onChange={setTvaRegime} options={["Mensuel", "Trimestriel"]} />
      </div>
      <div className="mt-5 space-y-3 rounded-xl bg-[#F8F7F7] p-4">
        <ResultRow label="TVA collectee" value={mad(tva.collected)} />
        <ResultRow label="TVA deductible" value={`-${mad(tvaDeductible)}`} muted />
        <div className="h-px bg-[rgba(13,21,38,0.12)]" />
        <div className="flex justify-between text-[16px] font-bold text-[#7A6668]"><span>TVA nette due</span><span>{mad(tva.due)}</span></div>
        <ResultRow label="Prochaine echeance" value={tvaRegime === "Mensuel" ? nextDeadline() : "20 du mois suivant le trimestre"} />
      </div>
    </ToolPanel>
  );
}

function IsSimulator() {
  const [isCA, setIsCA] = useState(1200000);
  const [isCharges, setIsCharges] = useState(850000);

  const isResult = useMemo(() => {
    const profit = Math.max(0, isCA - isCharges);
    const calculated = calcProgressiveIS(profit);
    const minimum = isCA * 0.0025;
    const payable = Math.max(calculated, minimum);
    return { profit, calculated, minimum, payable, acompte: payable * 0.25 };
  }, [isCA, isCharges]);

  return (
    <ToolPanel title="Simulateur IS">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField label="CA annuel HT (MAD)" value={isCA} onChange={setIsCA} />
        <NumberField label="Charges deductibles (MAD)" value={isCharges} onChange={setIsCharges} />
      </div>
      <div className="mt-5 space-y-3 rounded-xl bg-[#F8F7F7] p-4">
        <ResultRow label="Benefice imposable" value={mad(isResult.profit)} />
        <ResultRow label="IS calcule" value={mad(isResult.calculated)} />
        <ul className="space-y-1 text-[12px] text-[#6B7280]">
          <li>17.5% jusqu'a 300 000 MAD</li>
          <li>20% de 300 001 a 1 000 000 MAD</li>
          <li>22.75% de 1 000 001 a 100 000 000 MAD</li>
          <li>34% au-dela de 100 000 000 MAD</li>
        </ul>
        <ResultRow label="Cotisation minimale (0.25%)" value={mad(isResult.minimum)} />
        <div className="flex justify-between text-[16px] font-bold text-[#7A6668]"><span>IS a payer</span><span>{mad(isResult.payable)}</span></div>
        <ResultRow label="Acompte T1 (25%)" value={mad(isResult.acompte)} />
      </div>
    </ToolPanel>
  );
}

function PayrollSimulator() {
  const [salary, setSalary] = useState(9000);
  const [family, setFamily] = useState("Celibataire");
  const [children, setChildren] = useState(0);

  const payroll = useMemo(() => {
    const cnss = Math.min(salary, 6000) * 0.0448;
    const amo = salary * 0.0226;
    const fraisPro = Math.min(salary * 0.2, 2500);
    const taxable = Math.max(0, salary - cnss - amo - fraisPro);
    const ir = calcIR(taxable, family === "Marie", children);
    const net = Math.max(0, salary - cnss - amo - ir);
    const employerCost = salary * 1.185;
    return { cnss, amo, fraisPro, taxable, ir, net, employerCost };
  }, [salary, family, children]);

  return (
    <ToolPanel title="Simulateur Bulletin de Paie">
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField label="Salaire brut (MAD)" value={salary} onChange={setSalary} />
        <SelectField label="Situation familiale" value={family} onChange={setFamily} options={["Celibataire", "Marie"]} />
        <NumberField label="Nombre d'enfants" value={children} onChange={setChildren} max={6} />
      </div>
      <div className="mt-5 space-y-3 rounded-xl bg-[#F8F7F7] p-4">
        <ResultRow label="Salaire brut" value={mad(salary)} />
        <ResultRow label="CNSS salarie (4.48%, cap 6000)" value={`-${mad(payroll.cnss)}`} muted />
        <ResultRow label="AMO salarie (2.26%)" value={`-${mad(payroll.amo)}`} muted />
        <ResultRow label="Frais pro (20%, cap 2500/mois)" value={`-${mad(payroll.fraisPro)}`} muted />
        <ResultRow label="Net imposable" value={mad(payroll.taxable)} />
        <ResultRow label="IR net" value={`-${mad(payroll.ir)}`} muted />
        <div className="h-px bg-[rgba(13,21,38,0.12)]" />
        <div className="flex justify-between text-[16px] font-bold text-[#7A6668]"><span>Net a payer</span><span>{mad(payroll.net)}</span></div>
        <ResultRow label="Cout employeur total" value={mad(payroll.employerCost)} />
      </div>
    </ToolPanel>
  );
}

function RentabilitySimulator() {
  const [rentCA, setRentCA] = useState(120000);
  const [rentCharges, setRentCharges] = useState(45000);
  const [employees, setEmployees] = useState(3);
  const [avgSalary, setAvgSalary] = useState(7000);

  const rentability = useMemo(() => {
    const payrollMass = employees * avgSalary;
    const estimatedTva = Math.max(0, rentCA * 0.2 - rentCharges * 0.2);
    const result = rentCA - rentCharges - payrollMass - estimatedTva;
    const margin = rentCA > 0 ? (result / rentCA) * 100 : 0;
    return { payrollMass, estimatedTva, result, margin };
  }, [rentCA, rentCharges, employees, avgSalary]);

  return (
    <ToolPanel title="Simulateur Rentabilite">
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField label="CA mensuel (MAD)" value={rentCA} onChange={setRentCA} />
        <NumberField label="Charges mensuelles (MAD)" value={rentCharges} onChange={setRentCharges} />
        <NumberField label="Nombre d'employes" value={employees} onChange={setEmployees} max={10} />
        <NumberField label="Salaire moyen brut (MAD)" value={avgSalary} onChange={setAvgSalary} />
      </div>
      <div className="mt-5 space-y-3 rounded-xl bg-[#F8F7F7] p-4">
        <ResultRow label="CA mensuel" value={mad(rentCA)} />
        <ResultRow label="Charges" value={`-${mad(rentCharges)}`} muted />
        <ResultRow label="Masse salariale" value={`-${mad(rentability.payrollMass)}`} muted />
        <ResultRow label="TVA estimee" value={`-${mad(rentability.estimatedTva)}`} muted />
        <div className={`flex justify-between text-[16px] font-bold ${rentability.result >= 0 ? "text-[#7A6668]" : "text-[#DC2626]"}`}>
          <span>Resultat net estime</span><span>{mad(rentability.result)}</span>
        </div>
        <ResultRow label="Marge nette" value={`${rentability.margin.toFixed(1)}%`} />
      </div>
    </ToolPanel>
  );
}

export function SimulatorPage({ kind }: { kind: SimulatorKind }) {
  if (kind === "tva") return <TvaSimulator />;
  if (kind === "is") return <IsSimulator />;
  if (kind === "paie") return <PayrollSimulator />;
  return <RentabilitySimulator />;
}
