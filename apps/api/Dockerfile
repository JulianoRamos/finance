# Imagem de desenvolvimento da api, e também a do serviço `deps`, que instala as dependências do
# workspace. O código não entra na imagem: o Compose monta o repositório em /repo.
FROM node:24-slim

# O OpenSSL é do motor de migrações do Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# O pnpm vem pelo corepack, na versão do `packageManager` do package.json da raiz.
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Os pontos de montagem dos volumes do Compose, já com o dono do usuário 1000 (`node`), para o
# volume novo nascer com ele.
RUN mkdir -p /repo/node_modules /ms-playwright && chown -R node:node /repo /ms-playwright

USER node
WORKDIR /repo/apps/api
