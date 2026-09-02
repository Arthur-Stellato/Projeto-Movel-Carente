const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const opcoes = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'MóvelCarente API',
      version: '1.0.0',
      description:
        'API de uma plataforma de doação de itens físicos (móveis, eletrodomésticos, roupas etc). ' +
        'Qualquer pessoa pode cadastrar um item para doação, e outras pessoas podem solicitar recebê-lo.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Ambiente local' }],
    tags: [
      { name: 'Auth', description: 'Registro, login e recuperação de senha' },
      { name: 'Usuários', description: 'Perfil, endereços e administração de contas' },
      { name: 'Categorias', description: 'Categorias de itens de doação' },
      { name: 'Itens', description: 'Itens disponíveis para doação' },
      { name: 'Solicitações', description: 'Pedidos de interesse em um item' },
      { name: 'Favoritos', description: 'Itens salvos pelo usuário' },
      { name: 'Notificações', description: 'Avisos do sistema para o usuário' },
      { name: 'Denúncias', description: 'Moderação de itens e usuários' },
      { name: 'Avaliações', description: 'Avaliação bidirecional entre doador e solicitante após a doação' },
      { name: 'CEP', description: 'Consulta de CEP em 3 camadas (cache local → BrasilAPI → persiste)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token retornado pelo login, enviado no header Authorization: Bearer <token>',
        },
      },
      schemas: {
        Erro: {
          type: 'object',
          properties: { erro: { type: 'string', example: 'Mensagem descrevendo o problema' } },
        },
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            cpf: { type: 'string', nullable: true, example: '12345678900' },
            cnpj: { type: 'string', nullable: true, example: '11222333000181' },
            primeiroNome: { type: 'string', example: 'Ana' },
            ultimoNome: { type: 'string', example: 'Silva' },
            telefone: { type: 'string', nullable: true, example: '+5543999998888', description: 'Normalizado em E.164 no cadastro/edição (aceita entrada formatada ou não — ver POST /auth/registro)' },
            tipo: { type: 'string', enum: ['usuario', 'admin'] },
            genero: { type: 'string', enum: ['masculino', 'feminino', 'prefiro_nao_dizer', 'outro'], default: 'prefiro_nao_dizer' },
            emailVerificado: { type: 'boolean' },
            ativo: { type: 'boolean' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Endereco: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tipo: { type: 'string', example: 'residencial' },
            cep: { type: 'string', example: '86300000' },
            logradouro: { type: 'string', example: 'Rua das Flores, 123' },
            numero: { type: 'string', nullable: true },
            complemento: { type: 'string', nullable: true },
            bairro: { type: 'string', nullable: true },
            cidade: { type: 'string', example: 'Cornélio Procópio' },
            estado: { type: 'string', example: 'PR' },
            pais: { type: 'string', example: 'Brasil' },
            principal: { type: 'boolean' },
          },
        },
        Categoria: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nome: { type: 'string', example: 'Móveis' },
            slug: { type: 'string', example: 'moveis' },
            icone: { type: 'string', nullable: true },
            ativo: { type: 'boolean' },
          },
        },
        ImagemItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            url: { type: 'string', format: 'uri' },
            ordem: { type: 'integer' },
          },
        },
        ItemDoacao: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            titulo: { type: 'string', example: 'Sofá 3 lugares' },
            descricao: { type: 'string', example: 'Bom estado, sem manchas' },
            condicao: { type: 'string', enum: ['novo', 'seminovo', 'usado'] },
            status: { type: 'string', enum: ['disponivel', 'reservado', 'doado', 'cancelado'] },
            cidade: { type: 'string' },
            estado: { type: 'string', example: 'PR' },
            categoria: { $ref: '#/components/schemas/Categoria' },
            imagens: { type: 'array', items: { $ref: '#/components/schemas/ImagemItem' } },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        SolicitacaoItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            itemId: { type: 'string', format: 'uuid' },
            solicitanteId: { type: 'string', format: 'uuid' },
            mensagem: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pendente', 'aceita', 'recusada', 'cancelada'] },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Notificacao: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tipo: {
              type: 'string',
              enum: ['nova_solicitacao', 'solicitacao_aceita', 'solicitacao_recusada', 'item_denunciado', 'sistema'],
            },
            titulo: { type: 'string' },
            mensagem: { type: 'string' },
            lida: { type: 'boolean' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Avaliacao: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            solicitacaoId: { type: 'string', format: 'uuid' },
            avaliadorId: { type: 'string', format: 'uuid' },
            avaliadoId: { type: 'string', format: 'uuid' },
            nota: { type: 'integer', minimum: 1, maximum: 5 },
            comentario: { type: 'string', nullable: true },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Denuncia: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tipo: { type: 'string', enum: ['item', 'usuario'] },
            motivo: {
              type: 'string',
              enum: ['conteudo_impropio', 'golpe', 'spam', 'item_nao_condiz', 'comportamento_abusivo', 'outro'],
            },
            descricao: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pendente', 'analisada', 'procedente', 'improcedente'] },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Favorito: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            item: { $ref: '#/components/schemas/ItemDoacao' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            usuario: { $ref: '#/components/schemas/Usuario' },
            accessToken: { type: 'string', description: 'JWT de curta duração (15 min)' },
          },
        },
      },
      responses: {
        NaoAutorizado: {
          description: 'Token ausente, inválido ou expirado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
        },
        Proibido: {
          description: 'Autenticado, mas sem permissão para essa ação',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
        },
        NaoEncontrado: {
          description: 'Recurso não encontrado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
        },
        Conflito: {
          description: 'Conflito com o estado atual do recurso',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
        },
        DadosInvalidos: {
          description: 'Dados de entrada inválidos',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
        },
      },
    },
  },
  apis: [path.join(__dirname, '../routes/*.js')],
};

const swaggerSpec = swaggerJsdoc(opcoes);

module.exports = swaggerSpec;
