FROM node:22-slim

WORKDIR /app

COPY . .
RUN npm install -g corepack@latest \
    && corepack pnpm install --frozen-lockfile \
    && corepack pnpm run build \
    && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
