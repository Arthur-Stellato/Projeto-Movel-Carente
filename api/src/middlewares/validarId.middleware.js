const { validarUuid } = require('../lib/validadores');

// Evita que um :id mal formado chegue até o Prisma (que rejeitaria com um erro cru
// de validação, não capturado por nenhum tratarErro — virando um 500 sem sentido
// em vez de um 400 claro). Uso: router.get('/:id', validarUuidParam('id'), controller...)
function validarUuidParam(nomeParam = 'id') {
  return (req, res, next) => {
    const valor = req.params[nomeParam];
    if (!validarUuid(valor)) {
      return res.status(400).json({ erro: `Parâmetro "${nomeParam}" inválido: deve ser um identificador válido` });
    }
    return next();
  };
}

module.exports = { validarUuidParam };