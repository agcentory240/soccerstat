# Этап 1: сборка
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY . .

# Этап 2: финальный образ с Playwright
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package*.json ./
RUN npm install
COPY --from=builder /usr/src/app/ .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]