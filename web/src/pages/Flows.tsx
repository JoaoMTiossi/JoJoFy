import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flowsApi } from "../api/flows";
import { channelsApi } from "../api/channels";

export default function Flows() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: flows } = useQuery({ queryKey: ["flows"], queryFn: flowsApi.list });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: channelsApi.list });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");

  const createMutation = useMutation({
    mutationFn: flowsApi.create,
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      navigate(`/flows/${flow.id}`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, channelId });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Chatbot</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {showForm ? "Cancelar" : "Novo fluxo"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Nome do fluxo" value={name} onChange={(e) => setName(e.target.value)} required />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={channelId} onChange={(e) => setChannelId(e.target.value)} required>
            <option value="">Canal…</option>
            {channels?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Criar e editar</button>
        </form>
      )}

      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {flows?.map((f) => (
          <li key={f.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <Link to={`/flows/${f.id}`} className="text-brand-700 hover:underline">
              {f.name}
            </Link>
            <span className="text-slate-400">{Array.isArray(f.keywords) ? f.keywords.join(", ") : f.keywords}</span>
          </li>
        ))}
        {flows?.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">Nenhum fluxo criado.</li>}
      </ul>
    </div>
  );
}
