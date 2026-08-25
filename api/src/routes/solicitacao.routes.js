const express = require('express');
const solicitacaoController = require('../controllers/solicitacao.controller');
const avaliacaoController = require('../controllers/avaliacao.controller');
const { autenticar } = require('../middlewares/auth.middleware');
const { validarUuidParam } = require('../middlewares/validarId.middleware');
const { validar } = require('../middlewares/validar.middleware');
const solicitacaoValidation = require('../validations/solicitacao.validation');
const avaliacaoValidation = require('../validations/avaliacao.validation');

const router = express.Router();

router.use(autenticar);

/**
 * @swagger
 * /solicitacoes:
 *   post:
 *     summary: Solicita interesse em um item disponível
 *     tags: [Solicitações]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId]
 *             properties:
 *               itemId: { type: string, format: uuid }
 *               mensagem: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Solicitação criada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { solicitacao: { $ref: '#/components/schemas/SolicitacaoItem' } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { description: "Não é possível solicitar o próprio item", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: "Item indisponível ou já solicitado por você", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/', validar(solicitacaoValidation.criar), solicitacaoController.criar);

/**
 * @swagger
 * /solicitacoes/minhas:
 *   get:
 *     summary: Lista as solicitações feitas pelo usuário autenticado (paginado)
 *     tags: [Solicitações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: tamanho
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada das minhas solicitações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 solicitacoes: { type: array, items: { $ref: '#/components/schemas/SolicitacaoItem' } }
 *                 total: { type: integer }
 *                 pagina: { type: integer }
 *                 tamanho: { type: integer }
 */
router.get('/minhas', solicitacaoController.minhasSolicitacoes);

/**
 * @swagger
 * /solicitacoes/item/{itemId}:
 *   get:
 *     summary: Lista as solicitações recebidas em um item, paginado (só o doador do item ou admin)
 *     tags: [Solicitações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: tamanho
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de solicitações recebidas nesse item
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 solicitacoes: { type: array, items: { $ref: '#/components/schemas/SolicitacaoItem' } }
 *                 total: { type: integer }
 *                 pagina: { type: integer }
 *                 tamanho: { type: integer }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.get('/item/:itemId', validarUuidParam('itemId'), solicitacaoController.listarPorItem);

/**
 * @swagger
 * /solicitacoes/{id}/aceitar:
 *   post:
 *     summary: Aceita uma solicitação (item vira reservado; demais pendentes do item viram recusadas automaticamente)
 *     tags: [Solicitações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Solicitação aceita" }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       409: { $ref: '#/components/responses/Conflito' }
 */
router.post('/:id/aceitar', validarUuidParam('id'), solicitacaoController.aceitar);

/**
 * @swagger
 * /solicitacoes/{id}/recusar:
 *   post:
 *     summary: Recusa uma solicitação específica
 *     tags: [Solicitações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Solicitação recusada" }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       409: { $ref: '#/components/responses/Conflito' }
 */
router.post('/:id/recusar', validarUuidParam('id'), solicitacaoController.recusar);

/**
 * @swagger
 * /solicitacoes/{id}/cancelar:
 *   post:
 *     summary: Cancela minha própria solicitação (só se ainda pendente)
 *     tags: [Solicitações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: "Solicitação cancelada" }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       409: { $ref: '#/components/responses/Conflito' }
 */
router.post('/:id/cancelar', validarUuidParam('id'), solicitacaoController.cancelar);

/**
 * @swagger
 * /solicitacoes/{id}/concluir:
 *   post:
 *     summary: Marca a doação como concluída (item vira doado)
 *     tags: [Solicitações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Doação concluída com sucesso" }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       409: { $ref: '#/components/responses/Conflito' }
 */
router.post('/:id/concluir', validarUuidParam('id'), solicitacaoController.concluir);

/**
 * @swagger
 * /solicitacoes/{id}/avaliacoes:
 *   post:
 *     summary: Avalia a outra parte de uma doação já concluída (só doador ou solicitante daquela solicitação)
 *     description: >
 *       A avaliação é "double-blind": a nota que você der só fica visível pra
 *       outra pessoa quando ela também tiver avaliado, ou depois de alguns dias
 *       (o que vier primeiro) — evita retaliação ou nota inflada por ver a nota
 *       do outro lado antes.
 *     tags: [Avaliações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nota]
 *             properties:
 *               nota: { type: integer, minimum: 1, maximum: 5 }
 *               comentario: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Avaliação registrada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { avaliacao: { $ref: '#/components/schemas/Avaliacao' } } }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 *       403: { description: "Você não participou dessa solicitação", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { description: "Doação ainda não concluída, ou você já avaliou essa solicitação", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/:id/avaliacoes', validarUuidParam('id'), validar(avaliacaoValidation.criar), avaliacaoController.criar);

/**
 * @swagger
 * /solicitacoes/{id}/avaliacoes:
 *   get:
 *     summary: Vê o status das avaliações de uma solicitação (sua própria sempre aparece; a do outro lado só quando revelada)
 *     tags: [Avaliações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Status das avaliações dessa solicitação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 minhaAvaliacao: { $ref: '#/components/schemas/Avaliacao' }
 *                 avaliacaoRecebida: { $ref: '#/components/schemas/Avaliacao' }
 *                 revelado: { type: boolean }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.get('/:id/avaliacoes', validarUuidParam('id'), avaliacaoController.listarPorSolicitacao);

module.exports = router;