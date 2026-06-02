# syntax=docker/dockerfile:1.6

# --- build stage ----------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Кешируем установку зависимостей отдельно от сорцов.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .
RUN npm run build

# --- runtime stage --------------------------------------------------------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
