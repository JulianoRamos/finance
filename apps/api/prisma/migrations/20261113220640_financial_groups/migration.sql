-- CreateTable
CREATE TABLE "financial_group" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "is_family_view" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "financial_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_group_member" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "financial_group_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "financial_group_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_group_member_entity_id_idx" ON "financial_group_member"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_group_member_group_entity_key" ON "financial_group_member"("financial_group_id", "entity_id");

-- AddForeignKey
ALTER TABLE "financial_group_member" ADD CONSTRAINT "financial_group_member_financial_group_id_fkey" FOREIGN KEY ("financial_group_id") REFERENCES "financial_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_group_member" ADD CONSTRAINT "financial_group_member_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o nome não é vazio nem só de espaços.
ALTER TABLE "financial_group" ADD CONSTRAINT "financial_group_name_check" CHECK (btrim("name") <> '');

-- Escrito à mão: só um grupo é a Visão Familiar.
CREATE UNIQUE INDEX "financial_group_family_view_key" ON "financial_group"("is_family_view") WHERE "is_family_view";

-- Escrito à mão: a Visão Familiar nasce aqui, vazia, uma vez só em cada banco (regra 6.2). Ela não vai
-- para a auditoria, porque não há pedido nem usuário.
INSERT INTO "financial_group" ("name", "is_family_view", "created_at", "updated_at")
VALUES ('Visão Familiar', true, now(), now());
