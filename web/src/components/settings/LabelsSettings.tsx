import { useState } from "react";
import type { FormEvent } from "react";
import { useCreateLabel, useDeleteLabel, useUpdateLabel } from "../../api/queries";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Chip } from "../ui/Chip";
import type { Pipe } from "../../types";

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];

export function LabelsSettings({ pipe }: { pipe: Pipe }) {
  const createLabel = useCreateLabel(pipe.id);
  const updateLabel = useUpdateLabel(pipe.id);
  const deleteLabel = useDeleteLabel(pipe.id);

  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createLabel.mutateAsync({ name, color });
    setName("");
    setColor(COLORS[0]);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Etiquetas</h2>

      <ul className="mb-6 flex flex-col gap-2">
        {pipe.labels.map((label) => (
          <li
            key={label.id}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-2"
          >
            <Chip color={label.color}>{label.name}</Chip>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateLabel.mutate({ labelId: label.id, data: { color: c } })}
                  className="h-5 w-5 rounded-full border border-slate-300"
                  style={{ backgroundColor: c }}
                />
              ))}
              <Button variant="ghost" onClick={() => deleteLabel.mutate(label.id)} className="text-red-600">
                Excluir
              </Button>
            </div>
          </li>
        ))}
        {pipe.labels.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma etiqueta cadastrada ainda.</p>
        )}
      </ul>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4"
      >
        <h3 className="text-sm font-semibold text-slate-700">Nova etiqueta</h3>
        <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-2 ${
                color === c ? "border-slate-800" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Button type="submit" disabled={createLabel.isPending} className="self-start">
          Adicionar
        </Button>
      </form>
    </div>
  );
}
