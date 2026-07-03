import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Phase } from "../../types";
import { CardItem } from "./CardItem";
import { Button } from "../ui/Button";

export function PhaseColumn({
  phase,
  cards,
  onCardClick,
  onAddCard,
}: {
  phase: Phase;
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard?: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: phase.id, data: { type: "phase" } });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-800">{phase.name}</h3>
          {phase.isDone && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              concluído
            </span>
          )}
          {phase.isCanceled && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
              cancelado
            </span>
          )}
        </div>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {cards.length}
        </span>
      </div>

      {onAddCard && (
        <div className="px-3 pt-2">
          <Button variant="secondary" className="w-full" onClick={onAddCard}>
            + Novo card
          </Button>
        </div>
      )}

      <div ref={setNodeRef} className="flex-1 overflow-y-auto px-3 py-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              isDone={phase.isDone}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">Nenhum card</p>
        )}
      </div>
    </div>
  );
}
