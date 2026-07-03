import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Chip } from "../ui/Chip";

function isOverdue(dueDate: string | null, isDone: boolean): boolean {
  if (!dueDate || isDone) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function CardItem({
  card,
  isDone,
  onClick,
}: {
  card: Card;
  isDone: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", phaseId: card.phaseId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const overdue = isOverdue(card.dueDate, isDone);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-testid="card-item"
      className="mb-2 cursor-grab rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300 active:cursor-grabbing"
    >
      <p className="mb-2 text-sm font-medium text-slate-900">{card.title}</p>

      {card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((cl) => (
            <Chip key={cl.labelId} color={cl.label.color}>
              {cl.label.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex -space-x-1">
          {card.assignees.map((a) => (
            <Avatar key={a.userId} name={a.user.name} size={20} />
          ))}
        </div>
        {card.dueDate && (
          <span className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
            {new Date(card.dueDate).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </div>
  );
}
