import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount } from "./helpers";

describe("contatos, listas, segmentos e opt-out", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("CRUD de contato com atributos customizados", async () => {
    const { token } = await registerTestAccount(app, `contact-${Date.now()}`);
    const auth = { authorization: `Bearer ${token}` };

    const attrRes = await app.inject({
      method: "POST",
      url: "/contacts/attributes",
      headers: auth,
      payload: { name: "cidade", type: "TEXT" },
    });
    expect(attrRes.statusCode).toBe(201);

    const createRes = await app.inject({
      method: "POST",
      url: "/contacts",
      headers: auth,
      payload: { name: "Maria Silva", phone: "11988887777", email: "maria@example.com", attributes: { cidade: "SP" } },
    });
    expect(createRes.statusCode).toBe(201);
    const contact = createRes.json();
    expect(contact.phone).toBe("+5511988887777");
    expect(contact.attributeValues[0].value).toBe("SP");

    const getRes = await app.inject({ method: "GET", url: `/contacts/${contact.id}`, headers: auth });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().timeline).toEqual([]);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/contacts/${contact.id}`,
      headers: auth,
      payload: { attributes: { cidade: "RJ" } },
    });
    expect(patchRes.json().attributeValues[0].value).toBe("RJ");
  });

  it("segmento filtra contatos por atributo com lógica AND", async () => {
    const { token } = await registerTestAccount(app, `segment-${Date.now()}`);
    const auth = { authorization: `Bearer ${token}` };

    await app.inject({ method: "POST", url: "/contacts/attributes", headers: auth, payload: { name: "cidade", type: "TEXT" } });
    await app.inject({
      method: "POST",
      url: "/contacts/attributes",
      headers: auth,
      payload: { name: "compras", type: "NUMBER" },
    });

    async function makeContact(name: string, cidade: string, compras: number) {
      const res = await app.inject({
        method: "POST",
        url: "/contacts",
        headers: auth,
        payload: { name, email: `${name.toLowerCase()}@ex.com`, attributes: { cidade, compras: String(compras) } },
      });
      return res.json();
    }

    await makeContact("Ana", "SP", 40);
    await makeContact("Bruno", "SP", 10);
    await makeContact("Carla", "RJ", 50);

    const segRes = await app.inject({
      method: "POST",
      url: "/segments",
      headers: auth,
      payload: {
        name: "SP com muitas compras",
        filter: {
          logic: "AND",
          conditions: [
            { attr: "cidade", op: "eq", value: "SP" },
            { attr: "compras", op: "gt", value: 30 },
          ],
        },
      },
    });
    expect(segRes.statusCode).toBe(201);
    const segment = segRes.json();

    const contactsRes = await app.inject({ method: "GET", url: `/segments/${segment.id}/contacts`, headers: auth });
    const contacts = contactsRes.json();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe("Ana");
  });

  it("importação CSV: linha inválida gera erro e as válidas são importadas", async () => {
    const { token } = await registerTestAccount(app, `csv-${Date.now()}`);
    const auth = { authorization: `Bearer ${token}` };

    const csv = ["nome,telefone,email", "João Bom,11999990000,joao@ex.com", "Sem Nome,11999990001,semnome@ex.com", ",11999990002,vazio@ex.com"].join(
      "\n"
    );

    const importRes = await app.inject({
      method: "POST",
      url: "/contacts/import",
      headers: auth,
      payload: {
        csv,
        mapping: { name: "nome", phone: "telefone", email: "email" },
      },
    });
    expect(importRes.statusCode).toBe(200);
    const report = importRes.json();
    expect(report.totalRows).toBe(3);
    expect(report.importedCount).toBe(2);
    expect(report.errorCount).toBe(1);
    expect(report.errors[0].message).toMatch(/Nome/);
  });

  it("opt-out registrado bloqueia checagem de envio para o canal", async () => {
    const { token } = await registerTestAccount(app, `optout-${Date.now()}`);
    const auth = { authorization: `Bearer ${token}` };

    const createRes = await app.inject({
      method: "POST",
      url: "/contacts",
      headers: auth,
      payload: { name: "Pedro", phone: "11977776666" },
    });
    const contact = createRes.json();

    const before = await app.inject({ method: "GET", url: `/contacts/${contact.id}/optout/WHATSAPP`, headers: auth });
    expect(before.json().optedOut).toBe(false);

    const optOutRes = await app.inject({
      method: "POST",
      url: `/contacts/${contact.id}/optout`,
      headers: auth,
      payload: { channelType: "WHATSAPP", reason: "SAIR" },
    });
    expect(optOutRes.statusCode).toBe(201);

    const after = await app.inject({ method: "GET", url: `/contacts/${contact.id}/optout/WHATSAPP`, headers: auth });
    expect(after.json().optedOut).toBe(true);
  });
});
