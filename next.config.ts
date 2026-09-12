import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 上级目录存在 package-lock.json，显式指定项目根避免 Turbopack 误判
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
