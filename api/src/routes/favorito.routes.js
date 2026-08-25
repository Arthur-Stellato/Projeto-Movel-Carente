const express = require('express');
const favoritoController = require('../controllers/favorito.controller');
const { autenticar } = require('../middlewares/auth.middleware');
const { validarUuidParam } = require('../middlewares/validarId.middleware');
const { validar } = require('../middlewares/validar.middleware');
const favoritoValidation = require('../validations/favorito.validation');

const router = express.Router();

router.use(autenticar);

/**
 * @swagger
 * /favoritos:
 *   get:
 *     summary: Lista os favoritos do usuário autenticado (paginado)
 *     tags: [Favoritos]
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
 *         description: Lista paginada de favoritos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favoritos: { type: array, items: { $ref: '#/components/schemas/Favorito' } }
 *                 total: { type: integer }
 *                 pagina: { type: integer }
 *                 tamanho: { type: integer }
 */
router.get('/', favoritoController.listar);

/**
 * @swagger
 * /favoritos:
 *   post:
 *     summary: Adiciona um item aos favoritos
 *     tags: [Favoritos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId]
 *             properties: { itemId: { type: string, format: uuid } }
 *     responses:
 *       201: { description: "Favorito adicionado" }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { description: "Item já está nos favoritos", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/', validar(favoritoValidation.adicionar), favoritoController.adicionar);

/**
 * @swagger
 * /favoritos/{itemId}:
 *   get:
 *     summary: Verifica se um item está nos meus favoritos
 *     tags: [Favoritos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Status do favorito
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { favoritado: { type: boolean } } }
 */
router.get('/:itemId', validarUuidParam('itemId'), favoritoController.verificar);

/**
 * @swagger
 * /favoritos/{itemId}:
 *   delete:
 *     summary: Remove um item dos favoritos
 *     tags: [Favoritos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: "Favorito removido" }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.delete('/:itemId', validarUuidParam('itemId'), favoritoController.remover);

module.exports = router;