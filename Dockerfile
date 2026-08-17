FROM node:22-slim

WORKDIR /app

# Vite embeds only public VITE_* configuration during the image build.
ARG VITE_APP_ID=
ARG VITE_APP_TITLE=FiberOps
ARG VITE_APP_LOGO=
ARG VITE_OAUTH_PORTAL_URL=
ARG VITE_ANALYTICS_ENDPOINT=
ARG VITE_ANALYTICS_WEBSITE_ID=
ARG VITE_FRONTEND_FORGE_API_URL=
ARG VITE_FRONTEND_FORGE_API_KEY=
ENV VITE_APP_ID=${VITE_APP_ID} \
    VITE_APP_TITLE=${VITE_APP_TITLE} \
    VITE_APP_LOGO=${VITE_APP_LOGO} \
    VITE_OAUTH_PORTAL_URL=${VITE_OAUTH_PORTAL_URL} \
    VITE_ANALYTICS_ENDPOINT=${VITE_ANALYTICS_ENDPOINT} \
    VITE_ANALYTICS_WEBSITE_ID=${VITE_ANALYTICS_WEBSITE_ID} \
    VITE_FRONTEND_FORGE_API_URL=${VITE_FRONTEND_FORGE_API_URL} \
    VITE_FRONTEND_FORGE_API_KEY=${VITE_FRONTEND_FORGE_API_KEY}

COPY . .
RUN npm install -g corepack@latest \
    && corepack pnpm install --frozen-lockfile \
    && corepack pnpm run build \
    && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
