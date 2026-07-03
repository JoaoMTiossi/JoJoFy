import type { Card, Phase } from "../types";

/**
 * Pure helper that computes the new board state (phases with their cards)
 * after moving a card to a target phase/index. Used for optimistic UI
 * updates before the server confirms the move via POST /cards/:id/move.
 */
export function moveCardInBoard(
  phases: Phase[],
  cardId: string,
  targetPhaseId: string,
  targetIndex: number
): Phase[] {
  let movingCard: Card | undefined;
  for (const phase of phases) {
    const found = phase.cards.find((c) => c.id === cardId);
    if (found) {
      movingCard = found;
      break;
    }
  }
  if (!movingCard) {
    return phases;
  }

  return phases.map((phase) => {
    const isSource = phase.cards.some((c) => c.id === cardId);
    const isTarget = phase.id === targetPhaseId;

    if (!isSource && !isTarget) {
      return phase;
    }

    let cards = phase.cards.filter((c) => c.id !== cardId);

    if (isTarget) {
      const insertAt = Math.max(0, Math.min(targetIndex, cards.length));
      cards = [
        ...cards.slice(0, insertAt),
        { ...movingCard!, phaseId: targetPhaseId },
        ...cards.slice(insertAt),
      ];
    }

    return {
      ...phase,
      cards: cards.map((c, index) => ({ ...c, position: index })),
    };
  });
}
