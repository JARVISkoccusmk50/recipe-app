import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3はネイティブモジュールなのでサーバーサイドのみで使用
  // Webpackがバンドルしようとしないように設定
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
