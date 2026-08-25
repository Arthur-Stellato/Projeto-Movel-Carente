/*
  Warnings:

  - You are about to alter the column `nome` on the `categorias` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `slug` on the `categorias` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `icone` on the `categorias` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `provedor` on the `contas_oauth` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `provedor_id` on the `contas_oauth` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `motivo` on the `denuncias` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `tipo` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `cep` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(8)`.
  - You are about to alter the column `logradouro` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `numero` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `complemento` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `bairro` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `cidade` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `pais` on the `enderecos` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `url` on the `imagens_item` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `titulo` on the `itens_doacao` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `cidade` on the `itens_doacao` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `acao` on the `logs_auditoria` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `entidade_afetada` on the `logs_auditoria` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `ip_origem` on the `logs_auditoria` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(45)`.
  - You are about to alter the column `titulo` on the `notificacoes` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `token` on the `refresh_tokens` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `user_agent` on the `refresh_tokens` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `ip_origem` on the `refresh_tokens` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(45)`.
  - You are about to alter the column `token` on the `tokens_usuario` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `email` on the `usuarios` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `cpf` on the `usuarios` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(11)`.
  - You are about to alter the column `senha_hash` on the `usuarios` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `primeiro_nome` on the `usuarios` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `ultimo_nome` on the `usuarios` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `telefone` on the `usuarios` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.

*/
-- AlterTable
ALTER TABLE "categorias" ALTER COLUMN "nome" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "slug" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "icone" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "contas_oauth" ALTER COLUMN "provedor" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "provedor_id" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "denuncias" ALTER COLUMN "motivo" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "enderecos" ALTER COLUMN "tipo" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "cep" SET DATA TYPE VARCHAR(8),
ALTER COLUMN "logradouro" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "numero" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "complemento" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "bairro" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "cidade" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "pais" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "imagens_item" ALTER COLUMN "url" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "itens_doacao" ALTER COLUMN "titulo" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "cidade" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "logs_auditoria" ALTER COLUMN "acao" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "entidade_afetada" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "ip_origem" SET DATA TYPE VARCHAR(45);

-- AlterTable
ALTER TABLE "notificacoes" ALTER COLUMN "titulo" SET DATA TYPE VARCHAR(150);

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "token" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "user_agent" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "ip_origem" SET DATA TYPE VARCHAR(45);

-- AlterTable
ALTER TABLE "tokens_usuario" ALTER COLUMN "token" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "cpf" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "senha_hash" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "primeiro_nome" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "ultimo_nome" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "telefone" SET DATA TYPE VARCHAR(20);
