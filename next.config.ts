import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3はネイティブモジュールなのでサーバーサイドのみで使用
  // Webpackがバンドルしようとしないように設定
  serverExternalPackages: ['better-sqlite3'],
  // トンネル経由のスマホアクセスを許可
  allowedDevOrigins: ['*.loca.lt', '*.trycloudflare.com'],
};

export default nextConfig;
