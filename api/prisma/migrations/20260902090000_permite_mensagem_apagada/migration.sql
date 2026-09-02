-- Fase 6 (edição/soft-delete de mensagem): o soft-delete apaga conteúdo E
-- anexo de vez, por privacidade do remetente (ver mensagem.service.js,
-- deletarMensagem) — mas isso deixa os dois campos NULL ao mesmo tempo, o
-- que o CHECK original da fase 1 rejeitaria. Trocamos o CHECK por um que
-- também aceita esse terceiro caso: mensagem apagada (deletado_em
-- preenchido) não precisa mais ter conteúdo nem anexo.
ALTER TABLE "mensagens" DROP CONSTRAINT "mensagens_conteudo_ou_anexo_check";

ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conteudo_ou_anexo_ou_apagada_check"
  CHECK ("conteudo" IS NOT NULL OR "anexo_url" IS NOT NULL OR "deletado_em" IS NOT NULL);
