FROM node:22-alpine AS client
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /src/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=server --chown=node:node /src/server/node_modules ./server/node_modules
COPY --chown=node:node server/package.json server/app.js server/index.js ./server/
COPY --from=client --chown=node:node /src/client/dist ./client/dist
USER node
WORKDIR /app/server
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
