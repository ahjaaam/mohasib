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
  "frame-src https://challenges.cloudflare.com",
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
      { source: "/dashboard", destination: "/tableau-de-bord", permanent: false },
      { source: "/invoices", destination: "/factures", permanent: false },
      { source: "/invoices/new", destination: "/factures/nouvelle", permanent: false },
      { source: "/inbox", destination: "/boite-de-reception", permanent: false },
      { source: "/settings", destination: "/parametres", permanent: false },
      { source: "/pricing", destination: "/tarifs", permanent: false },
      { source: "/tva", destination: "/declarations-tva", permanent: false },
      { source: "/export", destination: "/export-fiduciaire", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/tableau-de-bord", destination: "/dashboard" },
      { source: "/factures", destination: "/invoices" },
      { source: "/factures/nouvelle", destination: "/invoices/new" },
      { source: "/factures/:id", destination: "/invoices/:id" },
      { source: "/boite-de-reception", destination: "/inbox" },
      { source: "/parametres", destination: "/settings" },
      { source: "/declarations-tva", destination: "/tva" },
      { source: "/export-fiduciaire", destination: "/export" },
      { source: "/comptable-pro/parametres", destination: "/comptable-pro/settings" },
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
