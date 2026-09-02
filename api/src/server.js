require('dotenv').config();

const { validarVariaveisDeAmbiente } = require('./lib/validarEnv');
validarVariaveisDeAmbiente();

const http = require('http');
const app = require('./app');
const configurarSocket = require('./socket');
const logger = require('./lib/logger');

const PORT = process.env.PORT || 3000;
const servidor = http.createServer(app);
configurarSocket(servidor);

servidor.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
});