-- CreateEnum
CREATE TYPE "entity_type" AS ENUM ('individual', 'company');

-- CreateEnum
CREATE TYPE "operation" AS ENUM ('clinic');

-- CreateTable
CREATE TABLE "entity" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "type" "entity_type" NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_operation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "entity_id" UUID NOT NULL,
    "operation" "operation" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entity_operation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entity_tax_id_key" ON "entity"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_operation_entity_operation_key" ON "entity_operation"("entity_id", "operation");

-- AddForeignKey
ALTER TABLE "entity_operation" ADD CONSTRAINT "entity_operation_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o nome não é vazio nem só de espaços.
ALTER TABLE "entity" ADD CONSTRAINT "entity_name_check" CHECK (btrim("name") <> '');

-- Escrito à mão: o documento é nulo, ou um CPF (11 algarismos) na pessoa física, ou um CNPJ (12 letras
-- maiúsculas ou algarismos e 2 algarismos, também o alfanumérico) na jurídica, só com os caracteres.
-- Os dígitos verificadores são conferidos pela api.
ALTER TABLE "entity" ADD CONSTRAINT "entity_tax_id_check" CHECK (
  "tax_id" IS NULL
  OR ("type" = 'individual' AND "tax_id" ~ '^[0-9]{11}$')
  OR ("type" = 'company' AND "tax_id" ~ '^[0-9A-Z]{12}[0-9]{2}$')
);
