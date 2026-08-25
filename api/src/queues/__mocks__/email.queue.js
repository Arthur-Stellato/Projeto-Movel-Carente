// Mock manual da fila de email. A versão real cria uma Queue do BullMQ, que abre
// conexão com o Redis na hora de ser importada — não deve acontecer em teste.
const enfileirarEmail = jest.fn().mockResolvedValue(undefined);

module.exports = {
  filaEmail: { add: jest.fn().mockResolvedValue(undefined) },
  enfileirarEmail,
};