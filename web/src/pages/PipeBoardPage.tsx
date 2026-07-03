import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { usePipe, useMoveCard, useUsers } from "../api/queries";
import { PhaseColumn } from "../components/board/PhaseColumn";
import { NewCardModal } from "../components/board/NewCardModal";
import { CardModal } from "../components/card/CardModal";
import { BoardFilters, type BoardFilterState } from "../components/board/BoardFilters";
import { moveCardInBoard } from "../board/reorder";
import { Button } from "../components/ui/Button";
import type { Card, Phase } from "../types";

function cardMatchesFilters(card: Card, filters: BoardFilterState, isDone: boolean): boolean {
  if (filters.search && !card.title.toLowerCase().includes(filters.search.toLowerCase())) {
    return false;
  }
  if (filters.assigneeId && !card.assignees.some((a) => a.userId === filters.assigneeId)) {
    return false;
  }
  if (filters.labelId && !card.labels.some((l) => l.labelId === filters.labelId)) {
    return false;
  }
  if (filters.onlyOverdue) {
    if (!card.dueDate || isDone) return false;
    if (new Date(card.dueDate).getTime() >= Date.now()) return false;
  }
  return true;
}

export default function PipeBoardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: pipe, isLoading, isError } = usePipe(id);
  const { data: users } = useUsers();
  const moveCard = useMoveCard(id!);

  const [localPhases, setLocalPhases] = useState<Phase[] | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>({
    search: "",
    assigneeId: "",
    labelId: "",
    onlyOverdue: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const phases = localPhases ?? pipe?.phases ?? [];

  const filteredPhases = useMemo(
    () =>
      phases.map((phase) => ({
        ...phase,
        cards: phase.cards.filter((card) => cardMatchesFilters(card, filters, phase.isDone)),
      })),
    [phases, filters]
  );

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-slate-500">Carregando pipe...</div>;
  }
  if (isError || !pipe) {
    return <div className="flex flex-1 items-center justify-center text-red-600">Pipe não encontrado.</div>;
  }

  function findPhaseAndIndex(phaseList: Phase[], cardId: string) {
    for (const phase of phaseList) {
      const index = phase.cards.findIndex((c) => c.id === cardId);
      if (index !== -1) return { phase, index };
    }
    return null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const currentPhases = localPhases ?? pipe!.phases;
    let targetPhaseId: string;
    let targetIndex: number;

    const overIsPhase = currentPhases.some((p) => p.id === overId);
    if (overIsPhase) {
      targetPhaseId = overId;
      targetIndex = currentPhases.find((p) => p.id === overId)!.cards.length;
    } else {
      const found = findPhaseAndIndex(currentPhases, overId);
      if (!found) return;
      targetPhaseId = found.phase.id;
      targetIndex = found.index;
    }

    const optimistic = moveCardInBoard(currentPhases, activeId, targetPhaseId, targetIndex);
    setLocalPhases(optimistic);

    try {
      await moveCard.mutateAsync({ cardId: activeId, phaseId: targetPhaseId, position: targetIndex });
    } finally {
      setLocalPhases(null);
    }
  }

  const firstPhaseId = pipe.phases[0]?.id;
  const activeCard = activeCardId
    ? phases.flatMap((p) => p.cards).find((c) => c.id === activeCardId) ?? null
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{pipe.icon}</span>
          <h1 className="text-lg font-semibold text-slate-900">{pipe.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setNewCardOpen(true)}>
            + Novo card
          </Button>
          <Link to={`/pipes/${pipe.id}/settings`}>
            <Button variant="ghost">Configurações</Button>
          </Link>
        </div>
      </div>

      <BoardFilters
        filters={filters}
        onChange={setFilters}
        users={users ?? []}
        labels={pipe.labels}
      />

      <div className="flex-1 overflow-x-auto p-6">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex h-full items-start gap-4">
            {filteredPhases.map((phase) => (
              <PhaseColumn
                key={phase.id}
                phase={phase}
                cards={phase.cards}
                onCardClick={(card) => setActiveCardId(card.id)}
                onAddCard={phase.id === firstPhaseId ? () => setNewCardOpen(true) : undefined}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {newCardOpen && (
        <NewCardModal
          open={newCardOpen}
          onClose={() => setNewCardOpen(false)}
          pipeId={pipe.id}
          fields={pipe.fields}
        />
      )}

      {activeCard && (
        <CardModal cardId={activeCard.id} pipe={pipe} onClose={() => setActiveCardId(null)} />
      )}
    </div>
  );
}
