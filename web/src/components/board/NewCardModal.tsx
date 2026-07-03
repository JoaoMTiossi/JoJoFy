import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { FieldInput } from "../fields/FieldInput";
import { useCreateCard } from "../../api/queries";
import { ApiError } from "../../api/client";
import type { Field } from "../../types";

export function NewCardModal({
  open,
  onClose,
  pipeId,
  fields,
}: {
  open: boolean;
  onClose: () => void;
  pipeId: string;
  fields: Field[];
}) {
  const createCard = useCreateCard(pipeId);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function resetAndClose() {
    setTitle("");
    setValues({});
    setErrors({});
    setFormError(null);
    onClose();
  }

  function validateClientSide(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const value = values[field.id];
      if (field.required && (!value || value.trim() === "")) {
        nextErrors[field.id] = `Campo "${field.label}" é obrigatório`;
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validateClientSide()) return;

    try {
      await createCard.mutateAsync({ title, values });
      resetAndClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.details && typeof err.details === "object") {
          setErrors(err.details as Record<string, string>);
        }
      } else {
        setFormError("Erro ao criar card");
      }
    }
  }

  return (
    <Modal open={open} onClose={resetAndClose} title="Novo card">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Título <span className="text-red-500">*</span>
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>

        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.id]: value }))}
            error={errors[field.id]}
          />
        ))}

        <Button type="submit" disabled={createCard.isPending} className="mt-2">
          {createCard.isPending ? "Criando..." : "Criar card"}
        </Button>
      </form>
    </Modal>
  );
}
