const express = require('express');
const authController = require('../controllers/auth.controller');
const { limitadorAuth } = require('../config/rateLimiter');
const { validar } = require('../middlewares/validar.middleware');
const usuarioValidation = require('../validations/usuario.validation');
const authValidation = require('../validations/auth.validation');

const router = express.Router();

/**
 * @swagger
 * /auth/registro:
 *   post:
 *     summary: Cria uma nova conta de usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha, primeiroNome, ultimoNome]
 *             properties:
 *               email: { type: string, format: email }
 *               cpf: { type: string, nullable: true, example: "12345678900", description: "CPF ou CNPJ é obrigatório; envie somente um deles" }
 *               cnpj: { type: string, nullable: true, example: "11222333000181", description: "CPF ou CNPJ é obrigatório; envie somente um deles" }
 *               senha: { type: string, format: password, minLength: 8 }
 *               primeiroNome: { type: string }
 *               ultimoNome: { type: string }
 *               telefone: { type: string }
 *               genero: { type: string, enum: [masculino, feminino, prefiro_nao_dizer, outro], description: "Opcional — sem informar, fica como prefiro_nao_dizer" }
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { usuario: { $ref: '#/components/schemas/Usuario' } }
 *       400: { $ref: '#/components/responses/DadosInvalidos' }
 *       409: { description: "Email ou documento já cadastrado", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/registro', limitadorAuth, validar(usuarioValidation.registro), authController.registrar);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Autentica um usuário e retorna o access token
 *     description: >
 *       O refreshToken NÃO vem no corpo da resposta — é entregue como cookie
 *       httpOnly (`refreshToken`), com escopo restrito a /auth/*. Inacessível a
 *       JavaScript no navegador (proteção contra roubo via XSS).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email: { type: string, format: email }
 *               senha: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login bem-sucedido. Cookie refreshToken (httpOnly) setado na resposta.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LoginResponse' }
 *       401: { description: "Email ou senha inválidos", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       403: { description: "Conta desativada ou temporariamente bloqueada por tentativas de login", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/login', limitadorAuth, validar(authValidation.login), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Troca o refresh token (cookie httpOnly) por um novo access token
 *     description: >
 *       O refreshToken é lido do cookie httpOnly enviado automaticamente pelo navegador —
 *       não é preciso mandar nada no corpo. O token usado é revogado e um novo é emitido
 *       (rotação): o cookie refreshToken da resposta já vem atualizado com o novo valor.
 *       Reusar um refresh token já rotacionado é tratado como possível roubo e revoga
 *       todas as sessões ativas do usuário.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Novo access token gerado. Cookie refreshToken (httpOnly) atualizado na resposta.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { accessToken: { type: string } } }
 *       401: { $ref: '#/components/responses/NaoAutorizado' }
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Revoga o refresh token (cookie httpOnly) e encerra a sessão
 *     description: O refreshToken é lido do cookie httpOnly; a resposta também limpa esse cookie no navegador.
 *     tags: [Auth]
 *     responses:
 *       204: { description: "Sessão encerrada" }
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /auth/esqueci-senha:
 *   post:
 *     summary: Solicita a recuperação de senha (envia email com token)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties: { email: { type: string, format: email } }
 *     responses:
 *       200:
 *         description: "Resposta genérica sempre igual, independente de o email existir (evita enumeração de contas)"
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { mensagem: { type: string } } }
 */
router.post('/esqueci-senha', limitadorAuth, validar(authValidation.emailParaAcao), authController.esqueciSenha);

/**
 * @swagger
 * /auth/redefinir-senha:
 *   post:
 *     summary: Redefine a senha usando o token recebido por email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, novaSenha]
 *             properties:
 *               token: { type: string }
 *               novaSenha: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: "Senha redefinida com sucesso (todas as sessões ativas são revogadas)" }
 *       401: { description: "Token inválido ou expirado", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/redefinir-senha', limitadorAuth, validar(authValidation.redefinirSenha), authController.redefinirSenha);

/**
 * @swagger
 * /auth/reenviar-verificacao:
 *   post:
 *     summary: Reenvia o email de verificação (se a conta existir e ainda não estiver verificada)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties: { email: { type: string, format: email } }
 *     responses:
 *       200:
 *         description: "Resposta genérica sempre igual (evita enumeração de contas e não revela se já foi verificado)"
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { mensagem: { type: string } } }
 */
router.post('/reenviar-verificacao', limitadorAuth, validar(authValidation.emailParaAcao), authController.reenviarVerificacao);

/**
 * @swagger
 * /auth/verificar-email:
 *   post:
 *     summary: Confirma o email usando o token recebido
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties: { token: { type: string } }
 *     responses:
 *       200: { description: "Email verificado com sucesso" }
 *       401: { description: "Token inválido ou expirado", content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post('/verificar-email', limitadorAuth, validar(authValidation.verificarEmail), authController.verificarEmail);

module.exports = router;
