import { describe, it, expect } from "vitest";
import { createTestApp, registerAndLogin, createPipe } from "./helpers.js";

async function addRequiredField(app: any, token: string, pipeId: string) {
  const response = await app.inject({
    method: "POST",
    url: `/api/pipes/${pipeId}/fields`,
    headers: { authorization: `Bearer ${token}` },
    payload: { label: "Cliente", type: "text", required: true },
  });
  return response.json().field;
}

describe("cards", () => {
  it("rejects card creation without a required field with 400", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const pipe = await createPipe(app, token);
    await addRequiredField(app, token, pipe.id);

    const response = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/cards`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Card sem cliente" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates a card in the first phase with a created activity", async () => {
    const app = await createTestApp();
    const { token, user } = await registerAndLogin(app);
    const pipe = await createPipe(app, token);
    const field = await addRequiredField(app, token, pipe.id);

    const response = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/cards`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Novo chamado", values: { [field.id]: "Empresa X" } },
    });
    expect(response.statusCode).toBe(201);
    const { card } = response.json();
    expect(card.phaseId).toBe(pipe.phases[0].id);
    expect(card.activities).toHaveLength(1);
    expect(card.activities[0].type).toBe("created");
    expect(card.values[0].value).toBe("Empresa X");
    void user;
  });

  it("moves a card between phases, renumbers positions and logs a moved activity", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const pipe = await createPipe(app, token);

    const createCard = (title: string) =>
      app
        .inject({
          method: "POST",
          url: `/api/pipes/${pipe.id}/cards`,
          headers: { authorization: `Bearer ${token}` },
          payload: { title },
        })
        .then((r: any) => r.json().card);

    const cardA = await createCard("Card A");
    const cardB = await createCard("Card B");
    const cardC = await createCard("Card C");

    const targetPhaseId = pipe.phases[1].id;
    const moveResponse = await app.inject({
      method: "POST",
      url: `/api/cards/${cardA.id}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { phaseId: targetPhaseId, position: 0 },
    });
    expect(moveResponse.statusCode).toBe(200);
    const movedCard = moveResponse.json().card;
    expect(movedCard.phaseId).toBe(targetPhaseId);
    expect(movedCard.position).toBe(0);
    expect(movedCard.activities.some((a: any) => a.type === "moved")).toBe(true);

    const pipeResponse = await app.inject({
      method: "GET",
      url: `/api/pipes/${pipe.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const fullPipe = pipeResponse.json().pipe;
    const firstPhaseCards = fullPipe.phases[0].cards.sort((a: any, b: any) => a.position - b.position);
    expect(firstPhaseCards.map((c: any) => c.id)).toEqual([cardB.id, cardC.id]);
    expect(firstPhaseCards.map((c: any) => c.position)).toEqual([0, 1]);

    const secondPhaseCards = fullPipe.phases[1].cards;
    expect(secondPhaseCards.map((c: any) => c.id)).toEqual([cardA.id]);
  });

  it("reorders cards within the same phase", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const pipe = await createPipe(app, token);

    const createCard = (title: string) =>
      app
        .inject({
          method: "POST",
          url: `/api/pipes/${pipe.id}/cards`,
          headers: { authorization: `Bearer ${token}` },
          payload: { title },
        })
        .then((r: any) => r.json().card);

    const cardA = await createCard("A");
    const cardB = await createCard("B");
    await createCard("C");

    await app.inject({
      method: "POST",
      url: `/api/cards/${cardB.id}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { phaseId: cardA.phaseId, position: 0 },
    });

    const pipeResponse = await app.inject({
      method: "GET",
      url: `/api/pipes/${pipe.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const fullPipe = pipeResponse.json().pipe;
    const cards = fullPipe.phases[0].cards.sort((a: any, b: any) => a.position - b.position);
    expect(cards.map((c: any) => c.title)).toEqual(["B", "A", "C"]);
  });

  it("assigns a user to a card and logs an activity", async () => {
    const app = await createTestApp();
    const { token, user } = await registerAndLogin(app);
    const pipe = await createPipe(app, token);
    const cardResponse = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/cards`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Card com responsável" },
    });
    const card = cardResponse.json().card;

    const response = await app.inject({
      method: "POST",
      url: `/api/cards/${card.id}/assignees`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user.id },
    });
    expect(response.statusCode).toBe(201);
    const updated = response.json().card;
    expect(updated.assignees).toHaveLength(1);
    expect(updated.assignees[0].user.id).toBe(user.id);
  });

  it("adds a comment to a card and logs an activity", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const pipe = await createPipe(app, token);
    const cardResponse = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/cards`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Card com comentário" },
    });
    const card = cardResponse.json().card;

    const commentResponse = await app.inject({
      method: "POST",
      url: `/api/cards/${card.id}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: "Olá, tudo bem?" },
    });
    expect(commentResponse.statusCode).toBe(201);

    const cardDetail = await app.inject({
      method: "GET",
      url: `/api/cards/${card.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const detail = cardDetail.json().card;
    expect(detail.comments).toHaveLength(1);
    expect(detail.activities.some((a: any) => a.type === "commented")).toBe(true);
  });

  it("updates card field values and logs a field_updated activity", async () => {
    const app = await createTestApp();
    const { token } = await registerAndLogin(app);
    const pipe = await createPipe(app, token);
    const field = await addRequiredField(app, token, pipe.id);
    const cardResponse = await app.inject({
      method: "POST",
      url: `/api/pipes/${pipe.id}/cards`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Card editável", values: { [field.id]: "Empresa Y" } },
    });
    const card = cardResponse.json().card;

    const response = await app.inject({
      method: "PATCH",
      url: `/api/cards/${card.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Título atualizado", values: { [field.id]: "Empresa Z" } },
    });
    expect(response.statusCode).toBe(200);
    const updated = response.json().card;
    expect(updated.title).toBe("Título atualizado");
    expect(updated.values.find((v: any) => v.fieldId === field.id).value).toBe("Empresa Z");
    expect(updated.activities.some((a: any) => a.type === "field_updated")).toBe(true);
  });
});
