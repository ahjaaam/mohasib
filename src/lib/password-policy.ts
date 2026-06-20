export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_REQUIREMENTS = "12 caractères minimum, avec majuscule, minuscule, chiffre et symbole";

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (!/[a-z]/.test(password)) return "Le mot de passe doit contenir une lettre minuscule.";
  if (!/[A-Z]/.test(password)) return "Le mot de passe doit contenir une lettre majuscule.";
  if (!/\d/.test(password)) return "Le mot de passe doit contenir un chiffre.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Le mot de passe doit contenir un symbole.";
  return null;
}
