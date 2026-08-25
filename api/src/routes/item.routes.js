const express = require('express');
const itemController = require('../controllers/item.controller');
const { autenticar, autenticarOpcional } = require('../middlewares/auth.middleware');
const { validarUuidParam } = require('../middlewares/validarId.middleware');
const { uploadImagensItem } = require('../middlewares/upload.middleware');
const { validar } = require('../middlewares/validar.middleware');
const itemValidation = require('../validations/item.validation');

const router = express.Router();

/**
 * @swagger
 * /itens:
 *   get:
 *     summary: Lista itens disponíveis, com filtros e paginação
 *     tags: [Itens]
 *     parameters:
 *       - in: query
 *         name: categoriaId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: cidade
 *         schema: { type: string }
 *       - in: query
 *         name: estado
 *         schema: { type: string, example: PR }
 *       - in: query
 *         name: busca
 *         schema: { type: string }
 *         description: Busca textual em título/descrição
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: tamanho
 *         schema: { type: integer, default: 12 }
 *     responses:
 *       200:
 *         description: Lista paginada de itens disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 itens: { type: array, items: { $ref: '#/components/schemas/ItemDoacao' } }
 *                 total: { type: integer }
 *                 pagina: { type: integer }
 *                 tamanho: { type: integer }
 */
router.get('/', validar(itemValidation.listar, 'query'), itemController.listar);

/**
 * @swagger
 * /itens/meus:
 *   get:
 *     summary: Lista os itens cadastrados pelo usuário autenticado, em qualquer status
 *     tags: [Itens]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Meus itens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { itens: { type: array, items: { $ref: '#/components/schemas/ItemDoacao' } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 */
router.get('/meus', autenticar, itemController.meusItens);

/**
 * @swagger
 * /itens/{id}:
 *   get:
 *     summary: Busca um item por id (endereço/telefone do doador só aparecem para o próprio doador ou para quem teve solicitação aceita)
 *     tags: [Itens]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Item encontrado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { item: { $ref: '#/components/schemas/ItemDoacao' } } }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.get('/:id', validarUuidParam('id'), autenticarOpcional, itemController.buscarPorId);

/**
 * @swagger
 * /itens:
 *   post:
 *     summary: Cadastra um novo item de doação
 *     tags: [Itens]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titulo, descricao, categoriaId, cidade, estado]
 *             properties:
 *               titulo: { type: string }
 *               descricao: { type: string }
 *               categoriaId: { type: string, format: uuid }
 *               condicao: { type: string, enum: [novo, seminovo, usado] }
 *               cidade: { type: string }
 *               estado: { type: string, example: PR }
 *               enderecoId: { type: string, format: uuid, nullable: true, description: "Deve pertencer ao usuário autenticado" }
 *               imagens: { type: array, items: { type: string, format: uri }, description: "URLs já hospedadas" }
 *     responses:
 *       201:
 *         description: Item criado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { item: { $ref: '#/components/schemas/ItemDoacao' } } }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 */
router.post('/', autenticar, validar(itemValidation.criar), itemController.criar);

/**
 * @swagger
 * /itens/{id}:
 *   put:
 *     summary: Edita um item (só o doador ou admin; só se status for disponivel ou reservado)
 *     tags: [Itens]
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
 *               titulo: { type: string }
 *               descricao: { type: string }
 *               categoriaId: { type: string, format: uuid }
 *               condicao: { type: string, enum: [novo, seminovo, usado] }
 *               cidade: { type: string }
 *               estado: { type: string }
 *               enderecoId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Item atualizado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { item: { $ref: '#/components/schemas/ItemDoacao' } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { description: "Item não está em um status editável", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.put('/:id', validarUuidParam('id'), autenticar, validar(itemValidation.atualizar), itemController.atualizar);

/**
 * @swagger
 * /itens/{id}:
 *   delete:
 *     summary: Cancela um item (soft delete; cancela em cascata as solicitações pendentes)
 *     tags: [Itens]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: "Item cancelado" }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { $ref: '#/components/responses/Conflito' }
 */
router.delete('/:id', validarUuidParam('id'), autenticar, itemController.cancelar);

/**
 * @swagger
 * /itens/{id}/imagens:
 *   post:
 *     summary: Adiciona imagens a um item (mantém ordem incremental)
 *     tags: [Itens]
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
 *             required: [urls]
 *             properties: { urls: { type: array, items: { type: string, format: uri } } }
 *     responses:
 *       201:
 *         description: Imagens adicionadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { imagens: { type: array, items: { $ref: '#/components/schemas/ImagemItem' } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 */
router.post('/:id/imagens', validarUuidParam('id'), autenticar, validar(itemValidation.adicionarImagens), itemController.adicionarImagens);

/**
 * @swagger
 * /itens/{id}/imagens/upload:
 *   post:
 *     summary: Envia arquivos de imagem reais para um item (multipart/form-data)
 *     tags: [Itens]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [imagens]
 *             properties:
 *               imagens:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: "Até 10 arquivos. JPEG, PNG ou WebP, até 5MB cada."
 *     responses:
 *       201:
 *         description: Imagens enviadas e salvas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { imagens: { type: array, items: { $ref: '#/components/schemas/ImagemItem' } } }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 */
router.post('/:id/imagens/upload', validarUuidParam('id'), autenticar, uploadImagensItem, itemController.uploadImagens);

/**
 * @swagger
 * /itens/{id}/imagens/{imagemId}:
 *   delete:
 *     summary: Remove uma imagem específica do item
 *     tags: [Itens]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: imagemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: "Imagem removida" }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.delete('/:id/imagens/:imagemId', validarUuidParam('id'), validarUuidParam('imagemId'), autenticar, itemController.removerImagem);

module.exports = router;