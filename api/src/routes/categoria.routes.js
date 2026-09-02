const express = require('express');
const categoriaController = require('../controllers/categoria.controller');
const { autenticar, autenticarOpcional, apenasAdmin } = require('../middlewares/auth.middleware');
const { validarUuidParam } = require('../middlewares/validarId.middleware');
const { validar } = require('../middlewares/validar.middleware');
const categoriaValidation = require('../validations/categoria.validation');

const router = express.Router();

/**
 * @swagger
 * /categorias:
 *   get:
 *     summary: Lista categorias ativas (admin autenticado também vê inativas com ?todas=true)
 *     tags: [Categorias]
 *     parameters:
 *       - in: query
 *         name: todas
 *         schema: { type: boolean }
 *         description: Só tem efeito se o requisitante for admin
 *     responses:
 *       200:
 *         description: Lista de categorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { categorias: { type: array, items: { $ref: '#/components/schemas/Categoria' } } }
 */
router.get('/', autenticarOpcional, categoriaController.listar);

/**
 * @swagger
 * /categorias/{id}:
 *   get:
 *     summary: Busca uma categoria por id
 *     description: Categoria inativa só aparece para administradores autenticados.
 *     tags: [Categorias]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Categoria encontrada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { categoria: { $ref: '#/components/schemas/Categoria' } } }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.get('/:id', autenticarOpcional, validarUuidParam('id'), categoriaController.buscarPorId);

/**
 * @swagger
 * /categorias:
 *   post:
 *     summary: Cria uma nova categoria (o slug é gerado automaticamente a partir do nome)
 *     tags: [Categorias]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome]
 *             properties:
 *               nome: { type: string, example: "Móveis" }
 *               icone: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Categoria criada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { categoria: { $ref: '#/components/schemas/Categoria' } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       409: { description: "Já existe uma categoria com esse nome", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/', autenticar, apenasAdmin, validar(categoriaValidation.criar), categoriaController.criar);

/**
 * @swagger
 * /categorias/{id}:
 *   put:
 *     summary: Atualiza uma categoria
 *     tags: [Categorias]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string }
 *               icone: { type: string }
 *               ativo: { type: boolean }
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { categoria: { $ref: '#/components/schemas/Categoria' } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.put('/:id', validarUuidParam('id'), autenticar, apenasAdmin, validar(categoriaValidation.atualizar), categoriaController.atualizar);

/**
 * @swagger
 * /categorias/{id}:
 *   delete:
 *     summary: Desativa uma categoria (soft delete — não apaga fisicamente)
 *     tags: [Categorias]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: "Categoria desativada" }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.delete('/:id', validarUuidParam('id'), autenticar, apenasAdmin, categoriaController.desativar);

module.exports = router;