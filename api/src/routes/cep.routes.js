const express = require('express');
const cepController = require('../controllers/cep.controller');
const { validar } = require('../middlewares/validar.middleware');
const { cepParam } = require('../validations/cep.validation');

const router = express.Router();

/**
 * @swagger
 * /cep/{cep}:
 *   get:
 *     summary: Consulta um CEP (cache local → ViaCEP → persiste pra próxima vez). Pública, sem autenticação.
 *     description: >
 *       Pensada pra o frontend usar como autofill do formulário de endereço:
 *       usuário digita o CEP, a tela já preenche logradouro/bairro/cidade/estado.
 *       Provedor padrão é o ViaCEP (gratuito, sem chave de API) — não devolve
 *       latitude/longitude (ViaCEP não faz geocodificação). Trocando a env var
 *       CEP_PROVIDER para "brasilapi", o mesmo endpoint passa a devolver
 *       coordenada quando disponível. De qualquer forma, as coordenadas aqui
 *       são só informativas — o backend resolve de novo, de forma independente,
 *       quando o endereço é de fato salvo (nunca confia em lat/lng vindo do cliente).
 *     tags: [CEP]
 *     parameters:
 *       - in: path
 *         name: cep
 *         required: true
 *         schema: { type: string, example: "86300-000" }
 *     responses:
 *       200:
 *         description: Endereço resolvido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 endereco:
 *                   type: object
 *                   properties:
 *                     cep: { type: string }
 *                     logradouro: { type: string, nullable: true }
 *                     bairro: { type: string, nullable: true }
 *                     cidade: { type: string }
 *                     estado: { type: string }
 *                     latitude: { type: number, nullable: true }
 *                     longitude: { type: number, nullable: true }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 *       404: { description: "CEP não encontrado", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       502: { description: "Serviço de CEP indisponível no momento", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get('/:cep', validar(cepParam, 'params'), cepController.buscar);

module.exports = router;
