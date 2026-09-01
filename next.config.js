/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.api.sanity.io https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "mohasibai.com", "www.mohasibai.com", "app.mohasibai.com", "facturation.mohasibai.com"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/invoices/new", destination: "/factures/nouvelle", permanent: false },
      { source: "/invoices/devis/new", destination: "/factures/devis/nouveau", permanent: false },
      { source: "/invoices/avoir/new", destination: "/factures/avoirs/nouveau", permanent: false },
      { source: "/invoices/:id/edit", destination: "/factures/:id/modifier", permanent: false },
      { source: "/invoices/:path*", destination: "/factures/:path*", permanent: false },
      { source: "/dashboard/:path*", destination: "/tableau-de-bord/:path*", permanent: false },
      { source: "/inbox/:path*", destination: "/boite-de-reception/:path*", permanent: false },
      { source: "/receipts/:path*", destination: "/notes-de-frais/:path*", permanent: false },
      { source: "/settings/:path*", destination: "/parametres/:path*", permanent: false },
      { source: "/chat/:path*", destination: "/assistant/:path*", permanent: false },
      { source: "/pricing", destination: "/tarifs", permanent: false },
      { source: "/tva/:path*", destination: "/declarations-tva/:path*", permanent: false },
      { source: "/export/:path*", destination: "/export-fiduciaire/:path*", permanent: false },
      { source: "/comptable-pro/settings/:path*", destination: "/comptable-pro/parametres/:path*", permanent: false },
      { source: "/comptable-pro/inbox-global/:path*", destination: "/comptable-pro/boite-de-reception-globale/:path*", permanent: false },
      { source: "/comptable-pro/dossiers/new", destination: "/comptable-pro/dossiers/nouveau", permanent: false },
      { source: "/comptable-pro/dossiers/:id/edit", destination: "/comptable-pro/dossiers/:id/modifier", permanent: false },
      { source: "/comptable-pro/dossiers/:id/dashboard/:path*", destination: "/comptable-pro/dossiers/:id/tableau-de-bord/:path*", permanent: false },
      { source: "/comptable-pro/dossiers/:id/inbox/:path*", destination: "/comptable-pro/dossiers/:id/boite-de-reception/:path*", permanent: false },
      { source: "/comptable-pro/dossiers/:id/receipts/:path*", destination: "/comptable-pro/dossiers/:id/notes-de-frais/:path*", permanent: false },
      { source: "/comptable-pro/dossiers/:id/invoices/new", destination: "/comptable-pro/dossiers/:id/factures/nouvelle", permanent: false },
      { source: "/comptable-pro/dossiers/:id/invoices/avoir/new", destination: "/comptable-pro/dossiers/:id/factures/avoirs/nouveau", permanent: false },
      { source: "/comptable-pro/dossiers/:id/invoices/:invoiceId/edit", destination: "/comptable-pro/dossiers/:id/factures/:invoiceId/modifier", permanent: false },
      { source: "/comptable-pro/dossiers/:id/invoices/:path*", destination: "/comptable-pro/dossiers/:id/factures/:path*", permanent: false },
      { source: "/comptable-pro/dossiers/:id/settings/:path*", destination: "/comptable-pro/dossiers/:id/parametres/:path*", permanent: false },
      { source: "/comptable-pro/dossiers/:id/export/:path*", destination: "/comptable-pro/dossiers/:id/export-fiduciaire/:path*", permanent: false },
      { source: "/facturation/invoices/:path*", destination: "/facturation/factures/:path*", permanent: false },
      { source: "/facturation/create/:intent", destination: "/facturation/creer/:intent", permanent: false },
      { source: "/transactions/avoirs-fournisseurs/new", destination: "/transactions/avoirs-fournisseurs/nouveau", permanent: false },
      { source: "/solutions", destination: "/#six-automatisations", permanent: true },
      { source: "/workflows", destination: "/#six-automatisations", permanent: true },
      { source: "/automatisations", destination: "/#six-automatisations", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/tableau-de-bord", destination: "/dashboard" },
      { source: "/factures", destination: "/invoices" },
      { source: "/factures/nouvelle", destination: "/invoices/new" },
      { source: "/factures/devis/nouveau", destination: "/invoices/devis/new" },
      { source: "/factures/avoirs/nouveau", destination: "/invoices/avoir/new" },
      { source: "/factures/:id/modifier", destination: "/invoices/:id/edit" },
      { source: "/factures/:id", destination: "/invoices/:id" },
      { source: "/boite-de-reception", destination: "/inbox" },
      { source: "/notes-de-frais", destination: "/receipts" },
      { source: "/parametres", destination: "/settings" },
      { source: "/assistant", destination: "/chat" },
      { source: "/declarations-tva", destination: "/tva" },
      { source: "/export-fiduciaire", destination: "/export" },
      { source: "/comptable-pro/parametres", destination: "/comptable-pro/settings" },
      { source: "/comptable-pro/boite-de-reception-globale", destination: "/comptable-pro/inbox-global" },
      { source: "/comptable-pro/dossiers/nouveau", destination: "/comptable-pro/dossiers/new" },
      { source: "/comptable-pro/dossiers/:id/modifier", destination: "/comptable-pro/dossiers/:id/edit" },
      { source: "/comptable-pro/dossiers/:id/tableau-de-bord", destination: "/comptable-pro/dossiers/:id/dashboard" },
      { source: "/comptable-pro/dossiers/:id/boite-de-reception", destination: "/comptable-pro/dossiers/:id/inbox" },
      { source: "/comptable-pro/dossiers/:id/notes-de-frais", destination: "/comptable-pro/dossiers/:id/receipts" },
      { source: "/comptable-pro/dossiers/:id/factures/nouvelle", destination: "/comptable-pro/dossiers/:id/invoices/new" },
      { source: "/comptable-pro/dossiers/:id/factures/avoirs/nouveau", destination: "/comptable-pro/dossiers/:id/invoices/avoir/new" },
      { source: "/comptable-pro/dossiers/:id/factures/:invoiceId/modifier", destination: "/comptable-pro/dossiers/:id/invoices/:invoiceId/edit" },
      { source: "/comptable-pro/dossiers/:id/factures/:invoiceId", destination: "/comptable-pro/dossiers/:id/invoices/:invoiceId" },
      { source: "/comptable-pro/dossiers/:id/factures", destination: "/comptable-pro/dossiers/:id/invoices" },
      { source: "/comptable-pro/dossiers/:id/parametres", destination: "/comptable-pro/dossiers/:id/settings" },
      { source: "/comptable-pro/dossiers/:id/export-fiduciaire", destination: "/comptable-pro/dossiers/:id/export" },
      { source: "/facturation/factures", destination: "/facturation/invoices" },
      { source: "/facturation/creer/:intent", destination: "/facturation/create/:intent" },
      { source: "/transactions/avoirs-fournisseurs/nouveau", destination: "/transactions/avoirs-fournisseurs/new" },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
