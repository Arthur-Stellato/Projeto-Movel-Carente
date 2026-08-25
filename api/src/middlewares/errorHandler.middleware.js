const logger = require('../lib/logger');

// Handler de rota não encontrada — Express cai aqui quando nenhuma rota do app bateu
// com o método+caminho da requisição. Sem isso, o Express usa a página HTML padrão dele.
function rotaNaoEncontrada(req, res) {
  return res.status(404).json({ erro: 'Rota não encontrada' });
}

// Handler de erro global — rede de segurança para qualquer erro que escape dos try/catch
// de cada controller. O caso mais comum: JSON malformado no corpo da requisição é rejeitado
// pelo express.json() ANTES de qualquer controller rodar, e sem esse handler o Express usa
// o handler de erro padrão dele, que devolve stack trace completo em HTML pro cliente.
// Precisa ter 4 parâmetros — é assim que o Express reconhece middleware de erro.
function manipuladorErroGlobal(err, req, res, next) {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ erro: 'JSON malformado no corpo da requisição' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição excede o tamanho máximo permitido' });
  }

  logger.error({ err }, 'Erro não tratado');
  return res.status(err.status || 500).json({ erro: 'Erro interno do servidor' });
}

module.exports = { rotaNaoEncontrada, manipuladorErroGlobal };