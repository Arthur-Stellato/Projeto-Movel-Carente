FROM node:22-bookworm-slim
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./
# O Prisma CLI é uma dependência de desenvolvimento neste projeto, mas também
# é necessário em tempo de execução para aplicar as migrations na inicialização.
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 3000

# Aplica migrations pendentes se houver, e inicia a aplicação
CMD ["sh", "-c", "npx prisma migrate deploy || true && npm start"]
