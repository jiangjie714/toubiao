#!/usr/bin/env bash
# ==============================================================================
# 标讯通 (toubiao) 一键停止脚本
# 功能：
#   1. 停止当前运行的 Next.js Web 开发服务及爬虫进程
#   2. 停止 Docker 容器 (PostgreSQL 等)
#   3. 可选：通过传入 --docker-app 参数同时退出 Docker Desktop 客户端
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"

echo "=========================================================="
echo "🛑 标讯通 (toubiao) 服务停止脚本"
echo "📂 项目目录: $PROJECT_DIR"
echo "=========================================================="

# 1. 查找并停止 Web 服务进程与爬虫进程
echo "🔍 [1/3] 正在查找并终止 Web 服务及爬虫进程..."

PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
NEXT_PIDS=$(pgrep -f "next.*dev" 2>/dev/null || true)
CRAWL_PIDS=$(pgrep -f "crawler.*worker" 2>/dev/null || true)
ALL_PIDS=$(echo "$PIDS $NEXT_PIDS $CRAWL_PIDS" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')

if [ -n "$ALL_PIDS" ]; then
  echo "   正在终止以下进程: $ALL_PIDS"
  for PID in $ALL_PIDS; do
    kill -15 "$PID" 2>/dev/null || true
  done
  sleep 1
  for PID in $ALL_PIDS; do
    kill -9 "$PID" 2>/dev/null || true
  done
  echo "✅ Web 服务与相关 Node 进程已全部终止"
else
  echo "ℹ️  未发现运行中的 Web 服务进程"
fi

# 2. 停止 Docker 容器服务 (PostgreSQL 等)
echo "📦 [2/3] 正在停止 Docker 容器依赖..."
if docker info >/dev/null 2>&1; then
  docker compose down
  echo "✅ Docker 容器服务已成功停止并释放端口 5432"
else
  echo "ℹ️  Docker 守护进程未运行或已停止"
fi

# 3. 可选处理：如果传入 --docker-app 或 --all 参数，则同时退出 Docker Desktop 应用
if [[ "$1" == "--docker-app" || "$1" == "--all" ]]; then
  echo "🖥️  [3/3] 正在退出 Docker Desktop 桌面应用程序..."
  osascript -e 'quit app "Docker"' 2>/dev/null || true
  echo "✅ Docker Desktop 退出指令已发送"
else
  echo "ℹ️  [3/3] Docker Desktop 保持就绪状态（若需连带退出 Docker Desktop，请运行: ./stop.sh --all）"
fi

echo "=========================================================="
echo "🎉 标讯通全部项目服务已安全停止！"
echo "=========================================================="
