"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { cgncAccounts } from "@/lib/cgnc-accounts";
import {
  ACCOUNTING_SETTING_CLASSES,
  isValidAccountingAccountCode,
  normalizeAccountingSettings,
  type BaseAccountingSettingKey,
} from "@/lib/accounting-settings";
import { DEFAULT_EXPENSE_CATEGORY_ACCOUNTS, DEFAULT_REVENUE_CATEGORY_ACCOUNTS, getAccountLabel } from "@/lib/cgnc-mapping";
import { translateError } from "@/lib/errors";

type Props = {
  target: "company" | "dossier";
  targetId: string;
  initialSettings: unknown;
};

const FIELDS: Array<{ key: BaseAccountingSettingKey; label: string; description: string }> = [
  { key: "clientAccount", label: "Compte clients", description: "Factures de vente et règlements clients" },
  { key: "salesAccount", label: "Compte de ventes", description: "Produits des factures et avoirs clients" },
  { key: "collectedTvaAccount", label: "TVA collectée", description: "TVA facturée aux clients" },
  { key: "supplierAccount", label: "Compte fournisseurs", description: "Dettes issues des factures d’achat" },
  { key: "recoverableTvaAccount", label: "TVA récupérable", description: "TVA déductible sur les achats" },
  { key: "salesCommercialDiscountAccount", label: "RRR accordés sur ventes", description: "Remises, rabais et ristournes accordés aux clients" },
  { key: "purchaseDiscountAccount", label: "RRR sur achats de marchandises", description: "Remises, rabais et ristournes obtenus sur marchandises" },
  { key: "purchaseConsumedDiscountAccount", label: "RRR sur achats consommés", description: "Réductions obtenues sur les comptes 612x" },
  { key: "purchaseExternalDiscountAccount", label: "RRR sur charges externes", description: "Réductions obtenues sur les comptes 613x et 614x" },
  { key: "salesSettlementDiscountAccount", label: "Escomptes accordés", description: "Escomptes financiers accordés aux clients" },
  { key: "purchaseSettlementDiscountAccount", label: "Escomptes obtenus", description: "Escomptes financiers obtenus des fournisseurs" },
  { key: "bankAccount", label: "Compte banque", description: "Encaissements et décaissements bancaires" },
];

function AccountCodeField({ value, allowedClasses, onChange, ariaLabel }: {
  value: string;
  allowedClasses: number[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const valid = isValidAccountingAccountCode(value, allowedClasses);
  const label = getAccountLabel(value);
  return (
    <div>
      <input
        className={`input font-mono ${valid ? "" : "border-red-300"}`}
        list="mohasib-cgnc-accounts"
        inputMode="numeric"
        maxLength={12}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={!valid}
        onChange={event => onChange(event.target.value.replace(/\D/g, ""))}
      />
      <span className={`mt-1 block text-[9.5px] ${valid ? "text-[#9CA3AF]" : "text-[#DC2626]"}`}>
        {valid ? (label === value ? "Compte personnalisé" : label) : `Compte de classe ${allowedClasses.join(" ou ")} requis (4 à 12 chiffres)`}
      </span>
    </div>
  );
}

export default function AccountingEntriesTab({ target, targetId, initialSettings }: Props) {
  const supabase = createClient();
  const [settings, setSettings] = useState(() => normalizeAccountingSettings(initialSettings));
  const [saving, setSaving] = useState(false);

  async function save() {
    const invalidFixed = FIELDS.some(field => !isValidAccountingAccountCode(settings[field.key], ACCOUNTING_SETTING_CLASSES[field.key]));
    const invalidRevenue = Object.values(settings.revenueCategoryAccounts).some(account => !isValidAccountingAccountCode(account, [7]));
    const invalidExpenses = Object.values(settings.expenseCategoryAccounts).some(account => !isValidAccountingAccountCode(account, [2, 6]));
    if (invalidFixed || invalidRevenue || invalidExpenses) {
      toast.error("Corrigez les numéros de compte signalés avant d’enregistrer.");
      return;
    }
    setSaving(true);
    const table = target === "company" ? "companies" : "dossiers";
    const { data, error } = await supabase
      .from(table)
      .update({ accounting_settings: settings, updated_at: new Date().toISOString() })
      .eq("id", targetId)
      .select("id")
      .maybeSingle();
    setSaving(false);

    if (error) toast.error(translateError(error));
    else if (!data) toast.error("Espace comptable introuvable ou accès insuffisant.");
    else toast.success("Personnalisation comptable enregistrée");
  }

  function reset() {
    setSettings(normalizeAccountingSettings(null));
  }

  function setCategoryAccount(group: "revenueCategoryAccounts" | "expenseCategoryAccounts", category: string, account: string) {
    setSettings(current => ({ ...current, [group]: { ...current[group], [category]: account } }));
  }

  function addCategory(group: "revenueCategoryAccounts" | "expenseCategoryAccounts", category: string, account: string) {
    setCategoryAccount(group, category, account);
  }

  function removeCategory(group: "revenueCategoryAccounts" | "expenseCategoryAccounts", category: string) {
    setSettings(current => {
      const next = { ...current[group] };
      delete next[category];
      return { ...current, [group]: next };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <datalist id="mohasib-cgnc-accounts">
        {cgncAccounts.map(account => <option key={account.code} value={account.code}>{account.label}</option>)}
      </datalist>
      <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E]">Écritures automatiques</h3>
        <p className="mt-1 text-[11.5px] leading-5 text-[#6B7280]">
          Choisissez les comptes utilisés pour les prochaines écritures. Les écritures déjà générées ne seront pas modifiées.
        </p>
      </div>

      <section className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
          <h4 className="text-[12px] font-semibold text-[#1A1A2E]">Comptes de structure</h4>
          <p className="mt-1 text-[10.5px] text-[#9CA3AF]">Quel compte ce dossier utilise-t-il pour les tiers, la TVA, la banque et les réductions ? Saisissez un compte CGNC ou un sous-compte personnalisé.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {FIELDS.map(field => {
              return (
                <label key={field.key} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-[#1A1A2E]">{field.label}</span>
                  <AccountCodeField value={settings[field.key]} allowedClasses={ACCOUNTING_SETTING_CLASSES[field.key]} ariaLabel={field.label}
                    onChange={value => setSettings(current => ({ ...current, [field.key]: value }))} />
                  <span className="text-[10.5px] text-[#9CA3AF]">{field.description}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-[#F1DFC5] bg-[#FFFBF5] px-3 py-2.5 text-[11px] leading-5 text-[#7A5B31]">
            Un compte choisi manuellement lors du contrôle d’un import reste prioritaire sur le mapping automatique.
          </div>
      </section>

      <section>
        <div className="mb-3 px-1">
          <h4 className="text-[12px] font-semibold text-[#1A1A2E]">Classement par catégorie</h4>
          <p className="mt-1 text-[10.5px] text-[#9CA3AF]">Associez chaque nature d’opération au compte proposé lors de la classification automatique.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CategoryMapping title="Produits / Revenus" mapping={settings.revenueCategoryAccounts} allowedClasses={[7]}
            defaultMapping={DEFAULT_REVENUE_CATEGORY_ACCOUNTS}
            onChange={(category, account) => setCategoryAccount("revenueCategoryAccounts", category, account)}
            onAdd={(category, account) => addCategory("revenueCategoryAccounts", category, account)}
            onRemove={category => removeCategory("revenueCategoryAccounts", category)} />
          <CategoryMapping title="Charges / Achats" mapping={settings.expenseCategoryAccounts} allowedClasses={[2, 6]}
            defaultMapping={DEFAULT_EXPENSE_CATEGORY_ACCOUNTS}
            onChange={(category, account) => setCategoryAccount("expenseCategoryAccounts", category, account)}
            onAdd={(category, account) => addCategory("expenseCategoryAccounts", category, account)}
            onRemove={category => removeCategory("expenseCategoryAccounts", category)} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={saving} className="btn btn-gold justify-center py-2.5 disabled:opacity-60">
          {saving ? "Enregistrement..." : "Enregistrer les comptes"}
        </button>
        <button onClick={reset} disabled={saving} className="btn btn-outline justify-center py-2.5 disabled:opacity-60">Rétablir les comptes CGNC</button>
      </div>
    </div>
  );
}

function CategoryMapping({ title, mapping, defaultMapping, allowedClasses, onChange, onAdd, onRemove }: {
  title: string;
  mapping: Record<string, string>;
  defaultMapping: Record<string, string>;
  allowedClasses: number[];
  onChange: (category: string, account: string) => void;
  onAdd: (category: string, account: string) => void;
  onRemove: (category: string) => void;
}) {
  const [newCategory, setNewCategory] = useState("");
  const [newAccount, setNewAccount] = useState(allowedClasses.includes(6) ? "6182" : "7131");
  const [addError, setAddError] = useState("");

  function submitCategory() {
    const category = newCategory.trim();
    if (!category) {
      setAddError("Indiquez un nom de catégorie.");
      return;
    }
    if (Object.keys(mapping).some(existing => existing.toLocaleLowerCase("fr") === category.toLocaleLowerCase("fr"))) {
      setAddError("Cette catégorie existe déjà.");
      return;
    }
    if (!isValidAccountingAccountCode(newAccount, allowedClasses)) {
      setAddError("Indiquez un numéro de compte valide.");
      return;
    }
    onAdd(category, newAccount);
    setNewCategory("");
    setAddError("");
  }

  return (
    <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
      <h4 className="text-[12px] font-semibold text-[#1A1A2E]">{title}</h4>
      <p className="mt-1 text-[10.5px] text-[#9CA3AF]">Que représente l’opération ? Mohasib propose ce compte après la classification OCR.</p>
      <div className="mt-4 flex flex-col gap-3">
        {Object.entries(mapping).map(([category, account]) => (
          <div key={category} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[150px_1fr_auto] sm:items-start">
            <span className="pt-2.5 text-[10.5px] font-medium text-[#374151]">{category === "__default" ? "Catégorie inconnue" : category}</span>
            <AccountCodeField value={account} allowedClasses={allowedClasses} ariaLabel={`Compte pour ${category === "__default" ? "catégorie inconnue" : category}`}
              onChange={value => onChange(category, value)} />
            {category !== "__default" && !(category in defaultMapping) && (
              <button type="button" onClick={() => onRemove(category)} className="mt-2 text-[10px] font-medium text-[#9CA3AF] hover:text-[#DC2626]">Supprimer</button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-[rgba(0,0,0,0.14)] bg-[#FAFAF8] p-3">
        <div className="text-[10.5px] font-semibold text-[#374151]">Ajouter une catégorie personnalisée</div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto] sm:items-start">
          <input className="input" value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder={allowedClasses.includes(6) ? "Ex. Glovo commissions" : "Ex. Ventes boissons"} aria-label={`Nouvelle catégorie ${title}`} />
          <AccountCodeField value={newAccount} allowedClasses={allowedClasses} ariaLabel={`Compte de la nouvelle catégorie ${title}`}
            onChange={setNewAccount} />
          <button type="button" onClick={submitCategory} className="btn btn-outline mt-0 justify-center whitespace-nowrap py-2.5 text-[10.5px]">Ajouter</button>
        </div>
        {addError && <p className="mt-1 text-[10px] text-[#DC2626]">{addError}</p>}
      </div>
    </div>
  );
}
