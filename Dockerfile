
FROM node:24-trixie-slim
WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY server.js database.js ./
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]
