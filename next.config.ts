import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "pdf-lib", "nodemailer"],
};

export default nextConfig;
