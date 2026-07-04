import { FastifyInstance } from "fastify";

export async function registerTestAccount(app: FastifyInstance, suffix = Date.now().toString()) {
  const email = `admin+${suffix}@acme.test`;
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { accountName: `Acme ${suffix}`, name: "Admin", email, password: "senha123" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Falha ao registrar conta de teste: ${res.statusCode} ${res.body}`);
  }
  const body = res.json();
  return { token: body.token as string, accountId: body.account.id as string, userId: body.user.id as string };
}
