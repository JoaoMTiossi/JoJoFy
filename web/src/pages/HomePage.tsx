import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { usePipes, useCreatePipe } from "../api/queries";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";

const ICONS = ["📋", "🎧", "💼", "🛒", "📦", "🧾", "🧑‍💼", "🚀"];
const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

export default function HomePage() {
  const { data: pipes, isLoading, isError } = usePipes();
  const createPipe = useCreatePipe();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createPipe.mutateAsync({ name, icon, color });
    setName("");
    setIcon(ICONS[0]);
    setColor(COLORS[0]);
    setOpen(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Meus pipes</h1>
        <Button onClick={() => setOpen(true)}>+ Novo pipe</Button>
      </div>

      {isLoading && <p className="text-slate-500">Carregando pipes...</p>}
      {isError && <p className="text-red-600">Erro ao carregar pipes.</p>}

      {!isLoading && pipes && pipes.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Você ainda não tem nenhum pipe. Crie o primeiro para começar.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pipes?.map((pipe) => (
          <Link
            key={pipe.id}
            to={`/pipes/${pipe.id}`}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                style={{ backgroundColor: `${pipe.color}22` }}
              >
                {pipe.icon}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-slate-900">{pipe.name}</h2>
                <p className="text-xs text-slate-500">
                  {pipe.activeCardsCount} card(s) ativo(s)
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo pipe">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Ícone</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg ${
                    icon === i ? "border-blue-500 bg-blue-50" : "border-slate-200"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cor</label>
            <div className="flex flex-wrap gap-2">
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
          </div>

          <Button type="submit" disabled={createPipe.isPending} className="mt-2">
            {createPipe.isPending ? "Criando..." : "Criar pipe"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
