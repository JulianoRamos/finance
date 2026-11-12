// A rota de saúde da web, para o healthcheck do Compose. Responde que o servidor do Next está no ar,
// sem chamar a api: a saúde da api é a rota dela.
export function GET(): Response {
  return Response.json({ web: 'no_ar' });
}
