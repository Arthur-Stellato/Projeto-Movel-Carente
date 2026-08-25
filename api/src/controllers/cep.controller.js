const cepService = require('../services/cep.service');
const { tratarErroController: tratarErro } = require('../lib/erros');

async function buscar(req, res) {
  try {
    const endereco = await cepService.buscarCep(req.params.cep);
    return res.status(200).json({ endereco });
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { buscar };
