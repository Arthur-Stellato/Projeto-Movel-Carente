const express = require('express');
const notificacaoController = require('../controllers/notificacao.controller');
const { autenticar } = require('../middlewares/auth.middleware');
const { validarUuidParam } = require('../middlewares/validarId.middleware');

const router = express.Router();

router.use(autenticar);

/**
 * @swagger
 * /notificacoes:
 *   get:
 *     summary: Lista as notificações do usuário autenticado (paginado)
 *     tags: [Notificações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: apenasNaoLidas
 *         schema: { type: boolean }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: tamanho
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de notificações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notificacoes: { type: array, items: { $ref: '#/components/schemas/Notificacao' } }
 *                 total: { type: integer }
 */
router.get('/', notificacaoController.listar);

/**
 * @swagger
 * /notificacoes/contagem-nao-lidas:
 *   get:
 *     summary: Retorna a contagem de notificações não lidas (para badge no frontend)
 *     tags: [Notificações]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Contagem
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { naoLidas: { type: integer } } }
 */
router.get('/contagem-nao-lidas', notificacaoController.contarNaoLidas);

/**
 * @swagger
 * /notificacoes/{id}/lida:
 *   patch:
 *     summary: Marca uma notificação específica como lida
 *     tags: [Notificações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notificação atualizada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { notificacao: { $ref: '#/components/schemas/Notificacao' } } }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.patch('/:id/lida', validarUuidParam('id'), notificacaoController.marcarComoLida);

/**
 * @swagger
 * /notificacoes/marcar-todas-lidas:
 *   patch:
 *     summary: Marca todas as notificações do usuário como lidas
 *     tags: [Notificações]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: "Todas marcadas como lidas" }
 */
router.patch('/marcar-todas-lidas', notificacaoController.marcarTodasComoLidas);

/**
 * @swagger
 * /notificacoes/{id}:
 *   delete:
 *     summary: Remove uma notificação
 *     tags: [Notificações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: "Notificação removida" }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.delete('/:id', validarUuidParam('id'), notificacaoController.remover);

module.exports = router;