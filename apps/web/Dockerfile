# Imagem de desenvolvimento da web, onde também rodam os testes de ponta a ponta. O código não entra
# na imagem: o Compose monta o repositório em /repo, e o serviço `deps` instala as dependências e o
# Chromium do Playwright, na versão do @playwright/test do lockfile, num volume.
FROM node:24-slim

# As bibliotecas do sistema que o Chromium usa. A versão do Playwright aqui só escolhe a lista de
# pacotes, que quase nunca muda: o navegador em si vem do volume.
RUN npx -y playwright@1.65.0 install-deps chromium && rm -rf /root/.npm

# O pnpm vem pelo corepack, na versão do `packageManager` do package.json da raiz.
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# A pasta .next da web também vira volume (compose.dev.yaml): criada aqui, o volume nasce com o dono node.
RUN mkdir -p /repo/node_modules /repo/apps/web/.next /ms-playwright && chown -R node:node /repo /ms-playwright

USER node
WORKDIR /repo/apps/web
