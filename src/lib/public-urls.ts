const DEFAULT_MARKETING_URL = "https://mohasibai.com";
const DEFAULT_APP_URL = "https://app.mohasibai.com";
const DEFAULT_INVOICING_URL = "https://facturation.mohasibai.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const MARKETING_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_MARKETING_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || DEFAULT_MARKETING_URL,
);

export const APP_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_APP_URL
    || DEFAULT_APP_URL,
);

export const INVOICING_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_INVOICING_URL
    || DEFAULT_INVOICING_URL,
);

export function marketingUrl(path = "/") {
  return `${MARKETING_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function appUrl(path = "/") {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function invoicingUrl(path = "/") {
  return `${INVOICING_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const WHATSAPP_NUMBER = "212777884056";

export function whatsappUrl(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
