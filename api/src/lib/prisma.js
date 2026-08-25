// Instância única do Prisma Client, reaproveitada em toda a aplicação (services,
// app.js, etc). Em testes, tests/jest.setup.js chama jest.mock('../src/lib/prisma')
// sem factory, o que faz o Jest resolver automaticamente o mock manual que mora em
// src/lib/__mocks__/prisma.js — este arquivo real nunca é executado durante os testes.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
