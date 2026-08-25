// Middleware genérico de validação — plugado nas rotas, antes do controller,
// pra que o controller/service já recebam dados garantidamente válidos.
//
// Uso: router.post('/', validar(schema), controller.criar)
//      router.get('/', validar(schema, 'query'), controller.listar)
//      router.get('/:cep', validar(schema, 'params'), controller.buscar)
//
// `propriedade` escolhe se valida req.body (padrão), req.query ou req.params.
//
// NOTA sobre req.query no Express 5: diferente de req.body e req.params (
// propriedades comuns, graváveis), req.query é um getter somente-leitura que
// reparsa a query string do req.url a cada acesso — reatribuir `req.query =
// valor` não tem efeito nenhum (falha silenciosamente, sem lançar erro). Por
// isso, pra `propriedade = 'query'` a validação só REJEITA entrada inválida
// (400); ela não tenta reescrever req.query com o valor convertido/tipado do
// Joi. O controller continua lendo req.query normalmente depois, já sabendo
// que passou pela validação.
function validar(schema, propriedade = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[propriedade], {
      abortEarly: false, // acumula todos os erros de uma vez, não só o primeiro
      stripUnknown: true, // ignora campos extras não declarados no schema
      convert: true, // permite trim/uppercase/coerção de tipo declarados no schema
    });

    if (error) {
      // Vários campos ausentes costumam cair na mesma mensagem agrupada (ex:
      // "CEP, logradouro, cidade e estado são obrigatórios" aparece uma vez
      // por campo faltando) — dedupe antes de juntar, senão a resposta repete
      // a mesma frase quatro vezes.
      const mensagens = [...new Set(error.details.map((detalhe) => detalhe.message))];
      return res.status(400).json({ erro: mensagens.join('; ') });
    }

    if (propriedade === 'body' || propriedade === 'params') {
      req[propriedade] = value;
    }

    return next();
  };
}

module.exports = { validar };
