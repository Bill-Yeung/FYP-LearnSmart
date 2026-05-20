FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/web/package.json ./apps/web/
RUN cd apps/web && npm install

COPY apps/web/ ./apps/web/
COPY shared/ ./shared/

RUN cd apps/web && npm run build

FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
