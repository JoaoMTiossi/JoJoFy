import { describe, it, expect } from "vitest";
import { createTestApp, registerAndLogin } from "./helpers.js";
import { prisma } from "../lib/prisma.js";

describe("pipes, phases, fields, labels", () => {
  it("creates a pipe with 3 default phases", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Suporte" },
    });
    expect(response.statusCode).toBe(201);
    const { pipe } = response.json();
    expect(pipe.phases).toHaveLength(3);
    expect(pipe.phases.map((p: any) => p.name)).toEqual([
      "Caixa de entrada",
      "Em andamento",
      "Concluído",
    ]);
    expect(pipe.phases[2].isDone).toBe(true);
  });

  it("lists pipes with active card counts", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Vendas" },
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().pipes.length).toBeGreaterThan(0);
  });

  it("reorders phases", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "RH" },
    });
    const pipe = createRes.json().pipe;
    const ids = pipe.phases.map((p: any) => p.id);
    const reversed = [...ids].reverse();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/pipes/${pipe.id}/phases/reorder`,
      headers: { authorization: `Bearer ${token}` },
      payload: { phaseIds: reversed },
    });
    expect(response.statusCode).toBe(200);
    const { phases } = response.json();
    expect(phases.map((p: any) => p.id)).toEqual(reversed);
  });

  it("returns 409 when deleting a phase that has cards", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Compras" },
    });
    const pipe = createRes.json().pipe;
    const firstPhaseId = pipe.phases[0].id;

    // Card creation is only exposed via HTTP from M4 onward; insert directly
    // through Prisma here so this phase-deletion test doesn't depend on it.
    await prisma.card.create({
      data: { phaseId: firstPhaseId, title: "Pedido 1", position: 0 },
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/api/phases/${firstPhaseId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(409);
  });

  it("deletes an empty phase successfully", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Financeiro" },
    });
    const pipe = createRes.json().pipe;
    const lastPhaseId = pipe.phases[2].id;

    const response = await app.inject({
      method: "DELETE",
      url: `/api/phases/${lastPhaseId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(204);
  });

  it("rejects a select field without options with 400", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Marketing" },
    });
    const pipe = createRes.json().pipe;

    const response = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/fields`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: "Prioridade", type: "select" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates a select field with options", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Jurídico" },
    });
    const pipe = createRes.json().pipe;

    const response = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/fields`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: "Prioridade", type: "select", options: ["Baixa", "Alta"] },
    });
    expect(response.statusCode).toBe(201);
  });

  it("creates and updates a label", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/pipes",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Operações" },
    });
    const pipe = createRes.json().pipe;

    const labelRes = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/labels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Urgente", color: "#ef4444" },
    });
    expect(labelRes.statusCode).toBe(201);
    const label = labelRes.json().label;

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/labels/${label.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Muito urgente" },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().label.name).toBe("Muito urgente");
  });

  it("requires authentication for pipe routes", async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/api/pipes" });
    expect(response.statusCode).toBe(401);
  });
});
