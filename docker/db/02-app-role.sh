#!/usr/bin/env bash
# O papel com que a api se conecta (LLD, seção 4.4): entra no banco, e não é dono de nada. As
# permissões dele nas tabelas vêm dos privilégios padrão que a primeira migração dá, em cada banco.
# Roda só na criação do volume do banco: num volume que já existe, recrie-o com
# `docker compose -f compose.dev.yaml down -v`.
set -euo pipefail

if [ -z "${POSTGRES_APP_PASSWORD:-}" ]; then
  echo "A variável POSTGRES_APP_PASSWORD não está definida: ela é a senha do papel finance_app." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
CREATE ROLE finance_app LOGIN PASSWORD :'app_password';
SQL
