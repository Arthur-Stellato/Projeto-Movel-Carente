const express = require('express');
const usuarioController = require('../controllers/usuario.controller');
const avaliacaoController = require('../controllers/avaliacao.controller');
const { autenticar, apenasAdmin } = require('../middlewares/auth.middleware');
const { validarUuidParam } = require('../middlewares/validarId.middleware');
const { validar } = require('../middlewares/validar.middleware');
const usuarioValidation = require('../validations/usuario.validation');

const router = express.Router();

router.use(autenticar);

/**
 * @swagger
 * /usuarios/me:
 *   get:
 *     summary: Retorna o perfil do usuário autenticado
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Perfil do usuário
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { usuario: { $ref: '#/components/schemas/Usuario' } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 */
router.get('/me', usuarioController.buscarPerfil);

/**
 * @swagger
 * /usuarios/me:
 *   put:
 *     summary: Atualiza nome/telefone do próprio perfil (email e CPF não são editáveis)
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primeiroNome: { type: string }
 *               ultimoNome: { type: string }
 *               telefone: { type: string }
 *     responses:
 *       200:
 *         description: Perfil atualizado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { usuario: { $ref: '#/components/schemas/Usuario' } } }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 */
router.put('/me', validar(usuarioValidation.atualizarPerfil), usuarioController.atualizarPerfil);

/**
 * @swagger
 * /usuarios/me/senha:
 *   patch:
 *     summary: Troca a senha do usuário autenticado (exige a senha atual; revoga sessões ativas)
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [senhaAtual, novaSenha]
 *             properties:
 *               senhaAtual: { type: string, format: password }
 *               novaSenha: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: "Senha alterada com sucesso" }
 *       403: { description: "Senha atual incorreta", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch('/me/senha', validar(usuarioValidation.alterarSenha), usuarioController.alterarSenha);

/**
 * @swagger
 * /usuarios/me/enderecos:
 *   get:
 *     summary: Lista os endereços do usuário autenticado
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Meus endereços
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { enderecos: { type: array, items: { $ref: '#/components/schemas/Endereco' } } }
 */
router.get('/me/enderecos', usuarioController.listarEnderecos);

/**
 * @swagger
 * /usuarios/me/enderecos:
 *   post:
 *     summary: Cadastra um novo endereço (o primeiro cadastrado vira principal automaticamente)
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cep, logradouro, cidade, estado]
 *             properties:
 *               cep: { type: string }
 *               logradouro: { type: string }
 *               numero: { type: string }
 *               complemento: { type: string }
 *               bairro: { type: string }
 *               cidade: { type: string }
 *               estado: { type: string, example: PR }
 *               pais: { type: string, default: Brasil }
 *               tipo: { type: string, default: residencial }
 *               principal: { type: boolean }
 *     responses:
 *       201:
 *         description: Endereço criado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { endereco: { $ref: '#/components/schemas/Endereco' } } }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 */
router.post('/me/enderecos', validar(usuarioValidation.criarEndereco), usuarioController.criarEndereco);

/**
 * @swagger
 * /usuarios/me/enderecos/{id}:
 *   put:
 *     summary: Atualiza um endereço próprio
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Endereco' }
 *     responses:
 *       200:
 *         description: Endereço atualizado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { endereco: { $ref: '#/components/schemas/Endereco' } } }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.put('/me/enderecos/:id', validarUuidParam('id'), validar(usuarioValidation.atualizarEndereco), usuarioController.atualizarEndereco);

/**
 * @swagger
 * /usuarios/me/enderecos/{id}:
 *   delete:
 *     summary: Remove um endereço próprio (recusado se algum item de doação ainda o usa)
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: "Endereço removido" }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { description: "Endereço em uso por um item de doação", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.delete('/me/enderecos/:id', validarUuidParam('id'), usuarioController.removerEndereco);

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Lista todos os usuários (admin)
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: ativo
 *         schema: { type: boolean }
 *       - in: query
 *         name: tipo
 *         schema: { type: string, enum: [usuario, admin] }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: tamanho
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usuarios: { type: array, items: { $ref: '#/components/schemas/Usuario' } }
 *                 total: { type: integer }
 *       403: { $ref: '#/components/responses/Proibido' }
 */
router.get('/', apenasAdmin, validar(usuarioValidation.listarTodos, 'query'), usuarioController.listarTodos);

/**
 * @swagger
 * /usuarios/{id}/desativar:
 *   patch:
 *     summary: Desativa a conta de um usuário (admin; revoga sessões; registra auditoria)
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Conta desativada com sucesso" }
 *       400: { description: "Admin não pode desativar a própria conta por essa rota", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.patch('/:id/desativar', validarUuidParam('id'), apenasAdmin, usuarioController.desativarConta);

/**
 * @swagger
 * /usuarios/{id}/reativar:
 *   patch:
 *     summary: Reativa a conta de um usuário (admin; registra auditoria)
 *     tags: [Usuários]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Conta reativada com sucesso" }
 *       403: { $ref: '#/components/responses/Proibido' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 */
router.patch('/:id/reativar', validarUuidParam('id'), apenasAdmin, usuarioController.reativarConta);

/**
 * @swagger
 * /usuarios/{id}/avaliacoes:
 *   get:
 *     summary: Lista as avaliações recebidas por um usuário (já filtradas pela regra de revelação) e a média
 *     tags: [Avaliações]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: Avaliações recebidas, paginadas, e a média
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 avaliacoes: { type: array, items: { $ref: '#/components/schemas/Avaliacao' } }
 *                 total: { type: integer }
 *                 media: { type: number, nullable: true }
 *                 pagina: { type: integer }
 *                 tamanho: { type: integer }
 */
router.get('/:id/avaliacoes', validarUuidParam('id'), avaliacaoController.listarRecebidas);

module.exports = router;