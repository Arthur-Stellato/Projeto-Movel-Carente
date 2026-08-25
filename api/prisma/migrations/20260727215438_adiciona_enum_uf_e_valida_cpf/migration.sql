/*
  Warnings:

  - Changed the type of `estado` on the `enderecos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `estado` on the `itens_doacao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UF" AS ENUM ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO');

-- AlterTable
ALTER TABLE "enderecos" DROP COLUMN "estado",
ADD COLUMN     "estado" "UF" NOT NULL;

-- AlterTable
ALTER TABLE "itens_doacao" DROP COLUMN "estado",
ADD COLUMN     "estado" "UF" NOT NULL;
