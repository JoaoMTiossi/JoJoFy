import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignsApi } from "../api/campaigns";
import { channelsApi } from "../api/channels";
import { templatesApi } from "../api/templates";
import { listsApi } from "../api/lists";
import { segmentsApi } from "../api/segments";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  RUNNING: "Em execução",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};

export default function Campaigns() {
  const queryClient = useQueryClient();
  const { data: campaigns } = useQuery({ queryKey: ["campaigns"], queryFn: campaignsApi.list });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: channelsApi.list });
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: () => templatesApi.list() });
  const { data: lists } = useQuery({ queryKey: ["lists"], queryFn: listsApi.list });
  const { data: segments } = useQuery({ queryKey: ["segments"], queryFn: segmentsApi.list });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [audienceType, setAudienceType] = useState<"list" | "segment">("list");
  const [audienceId, setAudienceId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variantBId, setVariantBId] = useState("");
  const [variantPct, setVariantPct] = useState<number | "">("");
  const [scheduleAt, setScheduleAt] = useState("");

  const createMutation = useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowForm(false);
      setName("");
    },
  });

  const filteredTemplates = templates?.filter((t) => !channelId || t.channelId === channelId);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name,
      channelId,
      listId: audienceType === "list" ? audienceId : undefined,
      segmentId: audienceType === "segment" ? audienceId : undefined,
      templateId,
      variantBId: variantBId || undefined,
      variantPct: variantBId && variantPct !== "" ? Number(variantPct) : undefined,
      scheduleAt: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Campanhas</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {showForm ? "Cancelar" : "Nova campanha"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Nome da campanha" value={name} onChange={(e) => setName(e.target.value)} required />

          <div className="flex gap-2">
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={channelId} onChange={(e) => setChannelId(e.target.value)} required>
              <option value="">Canal…</option>
              {channels?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={audienceType} onChange={(e) => setAudienceType(e.target.value as any)}>
              <option value="list">Lista</option>
              <option value="segment">Segmento</option>
            </select>

            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={audienceId} onChange={(e) => setAudienceId(e.target.value)} required>
              <option value="">Audiência…</option>
              {(audienceType === "list" ? lists : segments)?.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
            <option value="">Template (variante A)…</option>
            {filteredTemplates?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" value={variantBId} onChange={(e) => setVariantBId(e.target.value)}>
              <option value="">Sem teste A/B</option>
              {filteredTemplates?.map((t) => (
                <option key={t.id} value={t.id}>
                  Variante B: {t.name}
                </option>
              ))}
            </select>
            {variantBId && (
              <input
                type="number"
                min={1}
                max={99}
                className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="% para B"
                value={variantPct}
                onChange={(e) => setVariantPct(e.target.value === "" ? "" : Number(e.target.value))}
              />
            )}
          </div>

          <input
            type="datetime-local"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
          <p className="text-xs text-slate-400">Deixe em branco para enviar imediatamente.</p>

          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Criar campanha</button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Canal</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Enviadas / Total</th>
            </tr>
          </thead>
          <tbody>
            {campaigns?.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link to={`/campaigns/${c.id}`} className="text-brand-700 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.channelType}</td>
                <td className="px-4 py-2">{STATUS_LABEL[c.status]}</td>
                <td className="px-4 py-2">
                  {c.sentCount} / {c.totalCount}
                </td>
              </tr>
            ))}
            {campaigns?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Nenhuma campanha criada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
