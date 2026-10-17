#!/bin/sh
set -e

echo "=========================================================="
echo "🚀 标讯通 (Toubiao) 生产容器启动中..."
echo "=========================================================="

# 等待 PostgreSQL 数据库就绪
echo "⏳ 正在检测 PostgreSQL 数据库就绪状态..."
until nc -z -v -w3 postgres 5432 2>/dev/null; do
  echo "⏳ 等待 postgres:5432 联通..."
  sleep 2
done
echo "✅ PostgreSQL 连接正常！"

# 同步最新的 Prisma 数据结构
if [ "$RUN_DB_PUSH" = "true" ]; then
  echo "📦 正在同步数据库 Schema (prisma db push)..."
  npx prisma db push --skip-generate --accept-data-loss || true
fi

# 初始化基础数据（若指定了 SEED）
if [ "$RUN_DB_SEED" = "true" ]; then
  echo "🌱 正在执行基础数据初始化 (prisma seed)..."
  npx tsx prisma/seed.ts || true
fi

echo "▶️ 启动主进程: $@"
exec "$@"
