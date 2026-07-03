import { describe, it, expect } from "vitest";
import { moveCardInBoard } from "./reorder";
import type { Phase } from "../types";

function makeCard(id: string, phaseId: string, position: number) {
  return {
    id,
    phaseId,
    title: id,
    position,
    dueDate: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    values: [],
    assignees: [],
    labels: [],
  };
}

function makePhases(): Phase[] {
  return [
    {
      id: "p1",
      pipeId: "pipe1",
      name: "Fase 1",
      position: 0,
      isDone: false,
      isCanceled: false,
      cards: [makeCard("a", "p1", 0), makeCard("b", "p1", 1), makeCard("c", "p1", 2)],
    },
    {
      id: "p2",
      pipeId: "pipe1",
      name: "Fase 2",
      position: 1,
      isDone: false,
      isCanceled: false,
      cards: [makeCard("d", "p2", 0)],
    },
  ];
}

describe("moveCardInBoard", () => {
  it("reorders a card within the same phase", () => {
    const phases = makePhases();
    const result = moveCardInBoard(phases, "b", "p1", 0);
    const p1 = result.find((p) => p.id === "p1")!;
    expect(p1.cards.map((c) => c.id)).toEqual(["b", "a", "c"]);
    expect(p1.cards.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("moves a card to a different phase and renumbers both phases", () => {
    const phases = makePhases();
    const result = moveCardInBoard(phases, "a", "p2", 1);
    const p1 = result.find((p) => p.id === "p1")!;
    const p2 = result.find((p) => p.id === "p2")!;
    expect(p1.cards.map((c) => c.id)).toEqual(["b", "c"]);
    expect(p1.cards.map((c) => c.position)).toEqual([0, 1]);
    expect(p2.cards.map((c) => c.id)).toEqual(["d", "a"]);
    expect(p2.cards.map((c) => c.position)).toEqual([0, 1]);
    expect(p2.cards.find((c) => c.id === "a")?.phaseId).toBe("p2");
  });

  it("clamps target index within bounds", () => {
    const phases = makePhases();
    const result = moveCardInBoard(phases, "d", "p1", 999);
    const p1 = result.find((p) => p.id === "p1")!;
    expect(p1.cards.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns the same phases when the card does not exist", () => {
    const phases = makePhases();
    const result = moveCardInBoard(phases, "missing", "p1", 0);
    expect(result).toBe(phases);
  });
});
