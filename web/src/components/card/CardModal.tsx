import { useCard } from "../../api/queries";
import { Modal } from "../ui/Modal";
import type { Pipe } from "../../types";

/**
 * Minimal placeholder for the card detail modal. The full version (editable
 * fields, assignees, labels, comments and activity timeline) lands in the
 * PipeSettings/CardModal milestone.
 */
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
  void pipe;

  return (
    <Modal open onClose={onClose} title={isLoading ? "Carregando..." : card?.title}>
      {card && <p className="text-sm text-slate-500">Detalhes completos do card em breve.</p>}
    </Modal>
  );
}
