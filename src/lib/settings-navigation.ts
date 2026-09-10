import {
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  MessageSquare,
  Package,
  Palette,
  Plug,
  ScrollText,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SettingsTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  ownerOnly?: boolean;
};

export const SETTINGS_TABS: SettingsTab[] = [
  { id: "entreprise", label: "Entreprise", icon: Building2, permission: "settings:update" },
  { id: "profil", label: "Profil personnel", icon: User, permission: "settings:update" },
  { id: "apparence", label: "Apparence", icon: Palette, permission: "settings:update" },
  { id: "abonnement", label: "Abonnement", icon: CreditCard, ownerOnly: true },
  { id: "integrations", label: "Intégrations", icon: Plug, permission: "settings:update" },
  { id: "articles", label: "Articles & prestations", icon: Package, permission: "settings:update" },
  { id: "ecritures", label: "Écritures Auto", icon: ScrollText, permission: "settings:update" },
  { id: "tva", label: "Déclaration TVA", icon: FileText, permission: "settings:update" },
  { id: "echeances", label: "Échéances", icon: CalendarDays, permission: "settings:update" },
  { id: "messages", label: "Messages", icon: MessageSquare, permission: "settings:update" },
  { id: "equipe", label: "Équipe", icon: Users, permission: "settings:manage_team" },
];

// Settings shown inside a dossier are deliberately dossier-scoped. Keeping this
// list separate prevents company-level preferences from leaking into a client file.
export const DOSSIER_SETTINGS_TABS: SettingsTab[] = [
  { id: "dossier", label: "Dossier", icon: Building2 },
  { id: "facturation", label: "Facturation", icon: CreditCard },
  { id: "articles", label: "Articles & prestations", icon: Package },
  { id: "ecritures", label: "Écritures Auto", icon: ScrollText },
];

export const CLIENT_DOSSIER_SETTINGS_TABS: SettingsTab[] = [
  { id: "profil", label: "Profil personnel", icon: User },
  { id: "facturation", label: "Facturation", icon: CreditCard },
  { id: "articles", label: "Articles & prestations", icon: Package },
  { id: "integrations", label: "Intégrations", icon: Plug },
];

const FREE_PLAN_TABS = new Set(["entreprise", "profil", "apparence", "abonnement", "articles", "messages"]);

export function settingsTabAllowedOnPlan(tabId: string, plan: string) {
  return plan !== "free" || FREE_PLAN_TABS.has(tabId);
}
