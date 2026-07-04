import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { journeysApi } from "../api/journeys";
import { listsApi } from "../api/lists";

const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", ACTIVE: "Ativa", PAUSED: "Pausada" };

export default function Journeys() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: journeys } = useQuery({ queryKey: ["journeys"], queryFn: journeysApi.list });
  const { data: lists } = useQuery({ queryKey: ["lists"], queryFn: listsApi.list });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [listId, setListId] = useState("");

  const createMutation = useMutation({
    mutationFn: journeysApi.create,
    onSuccess: (journey) => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      navigate(`/journeys/${journey.id}`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, definition: { steps: [] }, listId });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Jornadas</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {showForm ? "Cancelar" : "Nova jornada"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Nome da jornada" value={name} onChange={(e) => setName(e.target.value)} required />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={listId} onChange={(e) => setListId(e.target.value)} required>
            <option value="">Lista de audiência…</option>
            {lists?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Criar e editar passos</button>
        </form>
      )}

      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {journeys?.map((j) => (
          <li key={j.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <Link to={`/journeys/${j.id}`} className="text-brand-700 hover:underline">
              {j.name}
            </Link>
            <span className="text-slate-400">{STATUS_LABEL[j.status]}</span>
          </li>
        ))}
        {journeys?.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">Nenhuma jornada criada.</li>}
      </ul>
    </div>
  );
}
