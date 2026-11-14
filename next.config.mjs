/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
    // Loaded from node_modules at runtime (pdfkit reads its font files from disk).
    serverComponentsExternalPackages: ["pdfkit", "exceljs"],
  },
};

export default nextConfig;
