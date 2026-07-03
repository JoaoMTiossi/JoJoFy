import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Chip } from "../ui/Chip";
import { Avatar } from "../ui/Avatar";
import { FieldInput } from "../fields/FieldInput";
import { CommentsSection } from "./CommentsSection";
import { ActivityTimeline } from "./ActivityTimeline";
import {
  useAddCardLabel,
  useAddComment,
  useAssignUser,
  useCard,
  useDeleteCard,
  useMoveCard,
  useRemoveCardLabel,
  useUnassignUser,
  useUpdateCard,
  useUsers,
} from "../../api/queries";
import type { Pipe } from "../../types";

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function CardModal({
  cardId,
  pipe,
  onClose,
}: {
  cardId: string;
  pipe: Pipe;
  onClose: () => void;
}) {
  const { data: card, isLoading } = useCard(cardId);
  const { data: users } = useUsers();
  const updateCard = useUpdateCard(pipe.id);
  const moveCard = useMoveCard(pipe.id);
  const assignUser = useAssignUser(pipe.id);
  const unassignUser = useUnassignUser(pipe.id);
  const addLabel = useAddCardLabel(pipe.id);
  const removeLabel = useRemoveCardLabel(pipe.id);
  const addComment = useAddComment(pipe.id);
  const deleteCard = useDeleteCard(pipe.id);

  const [title, setTitle] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      const values: Record<string, string> = {};
      for (const v of card.values) values[v.fieldId] = v.value;
      setFieldValues(values);
    }
  }, [card]);

  if (isLoading || !card) {
    return (
      <Modal open onClose={onClose} width="max-w-3xl">
        <p className="text-slate-500">Carregando card...</p>
      </Modal>
    );
  }

  const assignedIds = new Set(card.assignees.map((a) => a.userId));
  const cardLabelIds = new Set(card.labels.map((l) => l.labelId));

  async function handleTitleBlur() {
    if (title.trim() && title !== card!.title) {
      await updateCard.mutateAsync({ cardId: card!.id, data: { title } });
    }
  }

  async function handlePhaseChange(phaseId: string) {
    await moveCard.mutateAsync({ cardId: card!.id, phaseId, position: 999999 });
  }

  async function handleDueDateChange(value: string) {
    await updateCard.mutateAsync({
      cardId: card!.id,
      data: { dueDate: value ? new Date(value).toISOString() : null },
    });
  }

  async function handleFieldChange(fieldId: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    await updateCard.mutateAsync({ cardId: card!.id, data: { values: { [fieldId]: value } } });
  }

  async function handleToggleAssignee(userId: string) {
    if (assignedIds.has(userId)) {
      await unassignUser.mutateAsync({ cardId: card!.id, userId });
    } else {
      await assignUser.mutateAsync({ cardId: card!.id, userId });
    }
  }

  async function handleToggleLabel(labelId: string) {
    if (cardLabelIds.has(labelId)) {
      await removeLabel.mutateAsync({ cardId: card!.id, labelId });
    } else {
      await addLabel.mutateAsync({ cardId: card!.id, labelId });
    }
  }

  async function handleDelete() {
    if (confirm("Excluir este card?")) {
      await deleteCard.mutateAsync(card!.id);
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} width="max-w-3xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="mb-4 text-lg font-semibold"
          />

          <div className="mb-6 flex flex-col gap-3">
            {pipe.fields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                value={fieldValues[field.id] ?? ""}
                onChange={(value) => handleFieldChange(field.id, value)}
              />
            ))}
          </div>

          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Comentários</h3>
            <CommentsSection
              comments={card.comments ?? []}
              isSubmitting={addComment.isPending}
              onSubmit={async (body) => {
                await addComment.mutateAsync({ cardId: card.id, body });
              }}
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Atividade</h3>
            <ActivityTimeline activities={card.activities ?? []} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">Fase</label>
            <Select value={card.phaseId} onChange={(e) => handlePhaseChange(e.target.value)}>
              {pipe.phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Vencimento
            </label>
            <Input
              type="date"
              value={toDateInputValue(card.dueDate)}
              onChange={(e) => handleDueDateChange(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Responsáveis
            </label>
            <div className="flex flex-col gap-1">
              {users?.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={assignedIds.has(u.id)}
                    onChange={() => handleToggleAssignee(u.id)}
                  />
                  <Avatar name={u.name} size={20} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Etiquetas
            </label>
            <div className="flex flex-wrap gap-2">
              {pipe.labels.map((label) => {
                const active = cardLabelIds.has(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => handleToggleLabel(label.id)}
                    className={active ? "" : "opacity-40"}
                  >
                    <Chip color={label.color}>{label.name}</Chip>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="mt-4 text-left text-sm text-red-600 hover:underline"
          >
            Excluir card
          </button>
        </div>
      </div>
    </Modal>
  );
}
