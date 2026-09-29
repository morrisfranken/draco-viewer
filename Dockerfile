# Stage 1: bundle the viewer (three.js, Draco and Basis decoders) into dist/.
FROM node:22-alpine AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json ./
RUN npm install --ignore-scripts --no-audit --no-fund
COPY build.mjs drc-icon.svg ./
COPY web ./web
RUN npm run build

# Stage 2: serve the static files.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
