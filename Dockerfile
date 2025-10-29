FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 10003
CMD ["node","server.js"]
