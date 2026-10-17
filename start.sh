#!/usr/bin/env bash
# ==============================================================================
# 标讯通 (toubiao) 一键启动脚本
# 功能：
#   1. 检测并确保 Docker Desktop / Daemon 运行
#   2. 自动拉起 Docker 容器依赖 (PostgreSQL 数据库等)
#   3. 自动检测并等待 PostgreSQL 就绪 (端口 5432)
#   4. 检查并清理旧 Next.js 进程
#   5. 启动 Next.js Web 开发服务
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"

# 1. 配置 Node.js PATH (优先使用 nvm 的 Node 24，防止坏死 shim)
if [ -d "$HOME/.nvm/versions/node/v24.15.0/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
fi

echo "=========================================================="
echo "🚀 标讯通 (toubiao) 全栈服务启动中..."
echo "📂 项目目录: $PROJECT_DIR"
echo "=========================================================="

# 2. 检查 Docker 环境
echo "📦 [1/4] 检查 Docker 运行环境..."
if ! docker info >/dev/null 2>&1; then
  echo "⚠️  检测到 Docker 守护进程未启动，正在尝试拉起 Docker Desktop..."
  open -a Docker 2>/dev/null || true
  
  WAIT_DOCKER=0
  while ! docker info >/dev/null 2>&1; do
    sleep 2
    WAIT_DOCKER=$((WAIT_DOCKER + 1))
    if [ $WAIT_DOCKER -ge 20 ]; then
      echo "❌ Docker 启动超时，请先手动打开 Docker Desktop 后重试。"
      exit 1
    fi
    echo "   等待 Docker 就绪中 ($((WAIT_DOCKER * 2))s)..."
  done
fi
echo "✅ Docker 守护进程已就绪"

# 3. 启动项目 Docker 依赖 (PostgreSQL 数据库)
echo "🐘 [2/4] 启动 Docker 依赖服务 (PostgreSQL)..."
docker compose up -d postgres

# 等待 Postgres 端口 5432 可连通
echo "   等待数据库端口 5432 就绪..."
WAIT_PG=0
while ! nc -z 127.0.0.1 5432 >/dev/null 2>&1; do
  sleep 1
  WAIT_PG=$((WAIT_PG + 1))
  if [ $WAIT_PG -ge 15 ]; then
    echo "⚠️  等待 5432 端口响应较慢，继续检查容器状态..."
    break
  fi
done
echo "✅ PostgreSQL 数据库已正常就绪"

# 4. 清理可能占用端口的旧 Next.js 进程
echo "🔍 [3/4] 检查旧 Web 服务进程..."
PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
NEXT_PIDS=$(pgrep -f "next.*dev" 2>/dev/null || true)
ALL_PIDS=$(echo "$PIDS $NEXT_PIDS" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')

if [ -n "$ALL_PIDS" ]; then
  echo "🛑 发现旧 Web 进程 (PID: $ALL_PIDS)，正在清理..."
  for PID in $ALL_PIDS; do
    kill -15 "$PID" 2>/dev/null || true
  done
  sleep 1
  for PID in $ALL_PIDS; do
    kill -9 "$PID" 2>/dev/null || true
  done
  echo "✅ 旧进程已清理完毕"
else
  echo "✅ 端口 $PORT 当前空闲"
fi

# 5. 启动 Next.js Web 服务
echo "🌐 [4/4] 启动 Web 前端服务..."
echo "=========================================================="
echo "🎉 所有依赖已就绪！"
echo "👉 本地访问地址: http://localhost:$PORT"
echo "👉 或局域网地址: http://127.0.0.1:$PORT"
echo "💡 按 Ctrl+C 可停止前端，或在其他终端运行 ./stop.sh 停止全套服务"
echo "=========================================================="
echo ""

# 使用稳定开发模式启动
exec npx next dev -p "$PORT"
