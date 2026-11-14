-- CreateEnum
CREATE TYPE "permission_level" AS ENUM ('view', 'operate');

-- CreateTable
CREATE TABLE "permission" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "level" "permission_level" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permission_entity_idx" ON "permission"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_user_entity_key" ON "permission"("user_id", "entity_id");

-- AddForeignKey
ALTER TABLE "permission" ADD CONSTRAINT "permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: a entidade é do módulo Entidades e não tem relação no Prisma (LLD, seção 3). RESTRICT:
-- a entidade é desativada, e não excluída.
ALTER TABLE "permission" ADD CONSTRAINT "permission_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o uso inicial (regra 6.1). Todo usuário que gere acessos recebe operate em toda entidade
-- que já existe, uma vez só em cada banco. Sem isso, as entidades sumiriam da lista de quem as cadastrou.
INSERT INTO "permission" ("user_id", "entity_id", "level", "created_at", "updated_at")
SELECT u."id", e."id", 'operate', now(), now()
FROM "user" u CROSS JOIN "entity" e
WHERE u."manages_access";
