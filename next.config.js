/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-RateLimit-Limit", value: "100" },
];

const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "mohasibai.com", "www.mohasibai.com"],
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

export default nextConfig;
