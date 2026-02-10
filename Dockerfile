### STAGE 1: Build ###
FROM node:22-alpine AS base
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build:prod

# Install gzip and brotli compression tools and compress the build output
RUN apk add --no-cache gzip brotli \
 && find /usr/src/app/dist -type f -name '*.js' -exec gzip -k -f {} \; \
 && find /usr/src/app/dist -type f -name '*.css' -exec gzip -k -f {} \; \
 && find /usr/src/app/dist -type f -name '*.js' -exec brotli -f {} \; \
 && find /usr/src/app/dist -type f -name '*.css' -exec brotli -f {} \;

### STAGE 2: Run ###
FROM nginx:latest
RUN apt-get update && apt-get -y upgrade && apt-get clean && apt-get autoclean -y && rm -rf /var/lib/apt/list/*

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=base /usr/src/app/dist/fifa-card-generator /usr/share/nginx/html
