-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('masculino', 'feminino', 'prefiro_nao_dizer', 'outro');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "genero" "Genero" NOT NULL DEFAULT 'prefiro_nao_dizer';
