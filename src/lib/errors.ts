const ERROR_MAP: Record<string, string> = {
  // PostgreSQL constraint codes
  "23505": "Cette valeur existe déjà.",
  "23503": "Référence invalide — l'élément lié n'existe pas.",
  "23502": "Ce champ est obligatoire.",
  "23514": "La valeur saisie n'est pas valide.",

  // Supabase auth codes
  "invalid_credentials": "Email ou mot de passe incorrect.",
  "email_not_confirmed": "Veuillez confirmer votre email avant de vous connecter.",
  "user_already_exists": "Un compte existe déjà avec cet email.",
  "weak_password": "Le mot de passe est trop faible. Minimum 8 caractères.",
  "email_address_invalid": "L'adresse email n'est pas valide.",
  "over_email_send_rate_limit": "Trop d'emails envoyés. Attendez quelques minutes.",
  "session_not_found": "Session expirée. Veuillez vous reconnecter.",
  "over_request_rate_limit": "Trop de tentatives. Veuillez réessayer dans quelques minutes.",

  // HTTP / rate limit
  "429": "Trop de tentatives. Veuillez réessayer dans quelques minutes.",

  // Storage
  "Bucket not found": "Erreur de stockage. Contactez le support.",

  // Session / JWT
  "JWT expired": "Session expirée. Veuillez vous reconnecter.",
  "Invalid token": "Session invalide. Veuillez vous reconnecter.",
};

// Substrings checked against the full error message (case-insensitive)
const MESSAGE_MAP: [string, string][] = [
  ["trial_limit_reached:invoices", "Vous avez atteint la limite de votre essai gratuit (10 factures/devis/avoirs). Passez à un plan payant pour continuer."],
  ["trial_limit_reached:ocr_scans", "Vous avez atteint la limite de votre essai gratuit (10 documents scannés). Passez à un plan payant pour continuer."],
  ["trial_limit_reached:bank_statements", "L'essai gratuit permet d'importer 1 relevé bancaire. Passez à un plan payant pour importer tous vos relevés."],
  ["trial_limit_reached:employees", "L'essai gratuit permet de gérer 1 employé. Passez à un plan payant pour votre équipe complète."],
  ["trial_limit_reached:dossiers", "L'essai gratuit permet de créer 1 dossier client. Passez à un plan Comptable Pro pour en gérer davantage."],
  ["trial_feature_locked:tva_declarations", "La validation des déclarations TVA nécessite un plan payant. Vous pouvez continuer à préparer et prévisualiser votre déclaration."],
  ["idx_invoices_number", "Ce numéro de facture existe déjà pour ce dossier. Utilisez un numéro différent."],
  ["duplicate key", "Cette valeur existe déjà."],
  ["new row violates row-level security", "Accès non autorisé."],
  ["violates row-level security", "Accès non autorisé."],
  ["network", "Erreur de connexion. Vérifiez votre internet."],
  ["failed to fetch", "Erreur de connexion. Vérifiez votre internet."],
  ["timeout", "La requête a pris trop de temps. Réessayez."],
  ["jwt expired", "Session expirée. Veuillez vous reconnecter."],
  ["invalid token", "Session invalide. Veuillez vous reconnecter."],
  ["bucket not found", "Erreur de stockage. Contactez le support."],
  ["email not confirmed", "Veuillez confirmer votre email avant de vous connecter."],
  ["invalid login credentials", "Email ou mot de passe incorrect."],
  ["user already registered", "Un compte existe déjà avec cet email."],
  ["password should be at least", "Le mot de passe est trop faible. Minimum 8 caractères."],
  ["rate limit", "Trop de tentatives. Veuillez réessayer dans quelques minutes."],
  ["too many requests", "Trop de tentatives. Veuillez réessayer dans quelques minutes."],
];

export function translateError(error: unknown): string {
  if (!error) return "Une erreur est survenue. Veuillez réessayer.";

  const code: string =
    (error as any)?.code ?? (error as any)?.status?.toString() ?? "";
  const message: string =
    (error as any)?.message ?? (error as any)?.error ?? String(error) ?? "";

  if (ERROR_MAP[code]) return ERROR_MAP[code];

  const lower = message.toLowerCase();
  for (const [key, translation] of MESSAGE_MAP) {
    if (lower.includes(key.toLowerCase())) return translation;
  }

  return "Une erreur est survenue. Veuillez réessayer.";
}
