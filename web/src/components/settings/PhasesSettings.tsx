import { useState } from "react";
import type { FormEvent } from "react";
import {
  useCreatePhase,
  useDeletePhase,
  useReorderPhases,
  useUpdatePhase,
} from "../../api/queries";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ApiError } from "../../api/client";
import type { Pipe } from "../../types";

export function PhasesSettings({ pipe }: { pipe: Pipe }) {
  const createPhase = useCreatePhase(pipe.id);
  const updatePhase = useUpdatePhase(pipe.id);
  const deletePhase = useDeletePhase(pipe.id);
  const reorderPhases = useReorderPhases(pipe.id);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sortedPhases = [...pipe.phases].sort((a, b) => a.position - b.position);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createPhase.mutateAsync({ name });
    setName("");
  }

  async function handleDelete(phaseId: string) {
    setError(null);
    try {
      await deletePhase.mutateAsync(phaseId);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível excluir a fase"
      );
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sortedPhases.length) return;
    const ids = sortedPhases.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderPhases.mutate(ids);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Fases do pipe</h2>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="mb-6 flex flex-col gap-2">
        {sortedPhases.map((phase, index) => (
          <li
            key={phase.id}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="text-xs text-slate-400 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === sortedPhases.length - 1}
                  onClick={() => move(index, 1)}
                  className="text-xs text-slate-400 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <Input
                defaultValue={phase.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== phase.name) {
                    updatePhase.mutate({ phaseId: phase.id, data: { name: e.target.value } });
                  }
                }}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={phase.isDone}
                  onChange={(e) =>
                    updatePhase.mutate({ phaseId: phase.id, data: { isDone: e.target.checked } })
                  }
                />
                concluído
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={phase.isCanceled}
                  onChange={(e) =>
                    updatePhase.mutate({
                      phaseId: phase.id,
                      data: { isCanceled: e.target.checked },
                    })
                  }
                />
                cancelado
              </label>
              <Button variant="ghost" onClick={() => handleDelete(phase.id)} className="text-red-600">
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <form
        onSubmit={handleCreate}
        className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-4"
      >
        <Input
          placeholder="Nome da nova fase"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Button type="submit" disabled={createPhase.isPending}>
          Adicionar
        </Button>
      </form>
    </div>
  );
}
