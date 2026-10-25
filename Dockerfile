# gameWE web - container image.
#
#   docker build -t gamewe-web .
#   docker run -d --name gamewe-web -p 127.0.0.1:3000:3000 \
#     --env-file /etc/gamewe/web/web.env gamewe-web
#
# All settings are environment variables, see .env.example. BASE_PATH (e.g.
# /new behind a reverse proxy) is applied when the container starts.

# Base image written out in both FROM lines so Dependabot can update it.
FROM node:24-trixie-slim AS build
# Latest npm, without the "new version available" notice.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN npm install -g npm@latest
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Built with a placeholder sub path; scripts/set-base-path.sh puts the real
# one in at start.
ENV NEXT_TELEMETRY_DISABLED=1 \
    BASE_PATH=/__gamewe_base__
RUN npm run build

FROM node:24-trixie-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="gamewe-web" \
      org.opencontainers.image.description="gameWE statistics website and admin area" \
      org.opencontainers.image.licenses="GPL-3.0-or-later" \
      org.opencontainers.image.version="${VERSION}"
WORKDIR /app
# Owned by node: scripts/set-base-path.sh edits server.js here at start.
# The latest npm too, for npm run create-admin in the container.
RUN chown node:node /app && npm install -g npm@latest && npm cache clean --force
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    GAMEWE_DOCKER=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    BASE_PATH=
COPY --from=build --chown=node:node /src/.next/standalone ./
COPY --from=build --chown=node:node /src/.next/static ./.next/static
COPY --from=build --chown=node:node /src/public ./public
COPY --from=build --chown=node:node /src/scripts ./scripts
COPY --from=build --chown=node:node /src/templates ./templates
COPY --from=build --chown=node:node /src/LICENSE /src/THIRD-PARTY-LICENSES.md ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+(process.env.BASE_PATH||'').replace(/[\"']/g,'').replace(/\/+$/,'')+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "-r", "./scripts/access-log.cjs", "server.js"]
