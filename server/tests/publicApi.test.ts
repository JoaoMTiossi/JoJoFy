import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount } from "./helpers";

describe("API pública CPaaS", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createApiKey(token: string, scopes: string[]) {
    const res = await app.inject({
      method: "POST",
      url: "/api-keys",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Chave de teste", scopes },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; key: string };
  }

  it("envia mensagem via API key com escopo correto e consulta o status por ID", async () => {
    const { token } = await registerTestAccount(app, `pubapi-ok-${Date.now()}`);
    const apiKey = await createApiKey(token, ["messages:send", "messages:read"]);

    const sendRes = await app.inject({
      method: "POST",
      url: "/v1/channels/email/messages",
      headers: { "x-api-key": apiKey.key },
      payload: { to: "cliente@ex.com", text: "Olá, isto é um teste via API" },
    });
    expect(sendRes.statusCode).toBe(201);
    const sent = sendRes.json();
    expect(sent.status).toBe("QUEUED");
    expect(sent.channelType).toBe("EMAIL");

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/messages/${sent.id}`,
      headers: { "x-api-key": apiKey.key },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().body.text).toBe("Olá, isto é um teste via API");
  });

  it("rejeita chave de API revogada com 401", async () => {
    const { token } = await registerTestAccount(app, `pubapi-revoked-${Date.now()}`);
    const apiKey = await createApiKey(token, ["messages:send"]);

    const revokeRes = await app.inject({
      method: "DELETE",
      url: `/api-keys/${apiKey.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revokeRes.statusCode).toBe(204);

    const sendRes = await app.inject({
      method: "POST",
      url: "/v1/channels/email/messages",
      headers: { "x-api-key": apiKey.key },
      payload: { to: "cliente@ex.com", text: "Não deveria funcionar" },
    });
    expect(sendRes.statusCode).toBe(401);
  });

  it("rejeita chave sem o escopo necessário com 403", async () => {
    const { token } = await registerTestAccount(app, `pubapi-scope-${Date.now()}`);
    const apiKey = await createApiKey(token, ["messages:read"]); // sem messages:send

    const sendRes = await app.inject({
      method: "POST",
      url: "/v1/channels/email/messages",
      headers: { "x-api-key": apiKey.key },
      payload: { to: "cliente@ex.com", text: "Sem permissão" },
    });
    expect(sendRes.statusCode).toBe(403);
  });
});
