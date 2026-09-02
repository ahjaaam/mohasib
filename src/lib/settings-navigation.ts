import {
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  MessageSquare,
  Package,
  Palette,
  Plug,
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
  { id: "tva", label: "Déclaration TVA", icon: FileText, permission: "settings:update" },
  { id: "echeances", label: "Échéances", icon: CalendarDays, permission: "settings:update" },
  { id: "messages", label: "Messages", icon: MessageSquare, permission: "settings:update" },
  { id: "equipe", label: "Équipe", icon: Users, permission: "settings:manage_team" },
];

const FREE_PLAN_TABS = new Set(["entreprise", "profil", "apparence", "abonnement", "articles", "messages"]);

export function settingsTabAllowedOnPlan(tabId: string, plan: string) {
  return plan !== "free" || FREE_PLAN_TABS.has(tabId);
}
