FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
# O Prisma CLI é uma dependência de desenvolvimento neste projeto, mas também
# é necessário em tempo de execução para aplicar as migrations na inicialização.
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 3000

# As migrations são idempotentes e garantem que uma instalação vazia esteja
# pronta antes de a API aceitar conexões.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
