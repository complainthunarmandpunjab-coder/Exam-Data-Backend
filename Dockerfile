# Build stage
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

USER node

CMD ["node", "server.js"]
