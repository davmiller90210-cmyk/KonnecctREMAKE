FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

RUN yarn install --production

COPY packages/twenty-server/dist ./packages/twenty-server/dist
COPY packages/twenty-shared/dist ./packages/twenty-shared/dist

EXPOSE 3000

ENV NODE_ENV=production \
    PG_DATABASE_URL=postgres://postgres:postgres@db:5432/default \
    REDIS_URL=redis://redis:6379 \
    SERVER_URL=http://localhost:3000 \
    APP_SECRET=dev-secret-key-12345 \
    STORAGE_TYPE=local

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["node", "packages/twenty-server/dist/main.js"]
