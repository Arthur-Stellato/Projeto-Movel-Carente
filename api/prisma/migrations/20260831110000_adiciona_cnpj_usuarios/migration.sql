-- Permite cadastro de pessoa física (CPF) ou jurídica (CNPJ), nunca os dois
-- ao mesmo tempo. Registros existentes já têm CPF e continuam válidos.
ALTER TABLE "usuarios" ALTER COLUMN "cpf" DROP NOT NULL;
ALTER TABLE "usuarios" ADD COLUMN "cnpj" VARCHAR(14);

CREATE UNIQUE INDEX "usuarios_cnpj_key" ON "usuarios"("cnpj");

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_exatamente_um_documento_check"
  CHECK (
    ("cpf" IS NOT NULL AND "cnpj" IS NULL)
    OR ("cpf" IS NULL AND "cnpj" IS NOT NULL)
  );
