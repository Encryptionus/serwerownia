# --- budowanie ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# --- serwowanie ---
FROM nginx:1.27-alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/serwerownia.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx:alpine działa jako root tylko po to, by otworzyć port; przestawiamy na port
# nieuprzywilejowany i użytkownika bez uprawnień
RUN touch /var/run/nginx.pid \
 && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html
USER nginx

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
