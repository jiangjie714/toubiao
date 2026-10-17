FROM node:22-alpine AS builder

WORKDIR /app

# 设置国内镜像源
RUN npm config set registry https://registry.npmmirror.com

# 安装基础依赖
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# 拷贝代码
COPY . .

# 生成 Prisma Client 并构建生产代码
RUN npx prisma generate
RUN npm run build

# ==============================================================
# Production Image
# ==============================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 安装 netcat 用于健康检查
RUN apk add --no-cache netcat-openbsd

# 从 builder 复制完整环境与编译产物
COPY --from=builder /app ./

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
