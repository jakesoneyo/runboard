# NestJS 백엔드 프로덕션 이미지 (멀티스테이지)
# postinstall(prisma generate)이 schema.prisma를 필요로 하므로 prisma/를 package*.json과 함께 먼저 복사한다.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy && node dist/main.js"]
