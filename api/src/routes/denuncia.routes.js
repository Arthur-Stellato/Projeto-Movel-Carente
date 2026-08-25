const express = require('express');
const denunciaController = require('../controllers/denuncia.controller');
const { autenticar, apenasAdmin } = require('../middlewares/auth.middleware');
const { validarUuidParam } = require('../middlewares/validarId.middleware');
const { validar } = require('../middlewares/validar.middleware');
const denunciaValidation = require('../validations/denuncia.validation');

const router = express.Router();

router.use(autenticar);

/**
 * @swagger
 * /denuncias:
 *   post:
 *     summary: Denuncia um item ou um usuário
 *     tags: [Denúncias]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, motivo]
 *             properties:
 *               tipo: { type: string, enum: [item, usuario] }
 *               itemId: { type: string, format: uuid, description: "Obrigatório se tipo=item" }
 *               usuarioDenunciadoId: { type: string, format: uuid, description: "Obrigatório se tipo=usuario" }
 *               motivo: { type: string, enum: [conteudo_impropio, golpe, spam, item_nao_condiz, comportamento_abusivo, outro] }
 *               descricao: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Denúncia registrada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { denuncia: { $ref: '#/components/schemas/Denuncia' } } }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 *       403: { description: "Não é possível denunciar a si mesmo", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: "Já existe uma denúncia pendente sua para esse alvo", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/', validar(denunciaValidation.criar), denunciaController.criar);

/**
 * @swagger
 * /denuncias/minhas:
 *   get:
 *     summary: Lista as denúncias feitas pelo usuário autenticado (paginado)
 *     tags: [Denúncias]
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
 *         description: Lista paginada das minhas denúncias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 denuncias: { type: array, items: { $ref: '#/components/schemas/Denuncia' } }
 *                 total: { type: integer }
 *                 pagina: { type: integer }
 *                 tamanho: { type: integer }
 */
router.get('/minhas', denunciaController.listarMinhas);

/**
 * @swagger
 * /denuncias:
 *   get:
 *     summary: Lista todas as denúncias (admin)
 *     tags: [Denúncias]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pendente, analisada, procedente, improcedente] }
 *       - in: query
 *         name: tipo
 *         schema: { type: string, enum: [item, usuario] }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: tamanho
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de denúncias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 denuncias: { type: array, items: { $ref: '#/components/schemas/Denuncia' } }
 *                 total: { type: integer }
 *       403: { $ref: '#/components/responses/Proibido' }
 */
router.get('/', apenasAdmin, denunciaController.listarTodas);

/**
 * @swagger
 * /denuncias/{id}:
 *   get:
 *     summary: Detalhe completo de uma denúncia (admin)
 *     tags: [Denúncias]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Denúncia encontrada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { denuncia: { $ref: '#/components/schemas/Denuncia' } } }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.get('/:id', validarUuidParam('id'), apenasAdmin, denunciaController.buscarPorId);

/**
 * @swagger
 * /denuncias/{id}/analisar:
 *   patch:
 *     summary: Decide o status final de uma denúncia (admin)
 *     tags: [Denúncias]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [procedente, improcedente] }
 *               desativarItem: { type: boolean, description: "Se true e a denúncia for de item procedente, cancela o item" }
 *               desativarUsuario: { type: boolean, description: "Se true e a denúncia for de usuário procedente, desativa a conta denunciada" }
 *     responses:
 *       200:
 *         description: Denúncia analisada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { denuncia: { $ref: '#/components/schemas/Denuncia' } } }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { description: "Denúncia já analisada anteriormente", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch('/:id/analisar', validarUuidParam('id'), apenasAdmin, validar(denunciaValidation.analisar), denunciaController.analisar);

module.exports = router;