-- CreateEnum
CREATE TYPE "TipoAnexoMensagem" AS ENUM ('imagem', 'video');

-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'nova_mensagem';

-- CreateTable
CREATE TABLE "mensagens" (
    "id" UUID NOT NULL,
    "solicitacao_id" UUID NOT NULL,
    "remetente_id" UUID NOT NULL,
    "conteudo" VARCHAR(2000),
    "anexo_url" VARCHAR(500),
    "anexo_tipo" "TipoAnexoMensagem",
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "editado_em" TIMESTAMP(3),
    "deletado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensagens_solicitacao_id_criado_em_idx" ON "mensagens"("solicitacao_id", "criado_em");

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateCheck (adicionado à mão — Prisma Schema não suporta CHECK nativamente,
-- mesma situação da nota 1-5 em Avaliacao e do XOR item/usuário em Denuncia)
-- Garante que toda mensagem tem pelo menos texto OU anexo — nunca as duas
-- coisas vazias ao mesmo tempo. O Joi já impede isso na aplicação; isto é a
-- rede de segurança no nível do banco.
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conteudo_ou_anexo_check" CHECK ("conteudo" IS NOT NULL OR "anexo_url" IS NOT NULL);
