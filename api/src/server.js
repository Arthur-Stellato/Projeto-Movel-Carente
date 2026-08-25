require('dotenv').config();

const { validarVariaveisDeAmbiente } = require('./lib/validarEnv');
validarVariaveisDeAmbiente();

const app = require('./app');
const logger = require('./lib/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
});