/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
