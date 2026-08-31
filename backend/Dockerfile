# NestJS 백엔드 프로덕션 이미지 (멀티스테이지)
# postinstall(prisma generate)이 schema.prisma를 필요로 하므로 prisma/를 package*.json과 함께 먼저 복사한다.
FROM node:22-alpine AS builder
WORKDIR /app
# node:22-alpine은 npm 10을 내장하는데, npm 10의 lockfile 정합성 검사는 도달 불가능한
# optionalDependencies 서브트리(@emnapi/* — jest-resolve가 끌어오는 wasm32-wasi 바인딩,
# 어떤 플랫폼에서도 실제 설치되지 않음)를 오판해 `npm ci`를 EUSAGE로 실패시킨다.
# package.json의 overrides만으로는 npm 10에서 재현되고 npm 11에서만 정상 동작함을 확인했다
# (호스트 npm 11.6.2 dry-run은 통과, Docker 이미지 npm 10.9.8은 실패) — 이미지 안의 npm을
# 호스트와 같은 메이저로 올려 검증 로직 자체를 맞춘다.
RUN npm install -g npm@11.6.2
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
