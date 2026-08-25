-- CreateEnum
CREATE TYPE "StatusEventoOutbox" AS ENUM ('pendente', 'processado', 'falhou');

-- CreateTable
CREATE TABLE "eventos_outbox" (
    "id" UUID NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "StatusEventoOutbox" NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" VARCHAR(1000),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processado_em" TIMESTAMP(3),

    CONSTRAINT "eventos_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_outbox_status_criado_em_idx" ON "eventos_outbox"("status", "criado_em");
