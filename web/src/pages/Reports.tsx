import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports";

async function downloadCsv(type: "campaigns" | "messages" | "contacts") {
  const blob = await reportsApi.exportCsv(type);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [tab, setTab] = useState<"campaigns" | "bot" | "attendance">("campaigns");
  const { data: campaigns } = useQuery({ queryKey: ["reportsCampaigns"], queryFn: reportsApi.campaigns, enabled: tab === "campaigns" });
  const { data: bot } = useQuery({ queryKey: ["reportsBot"], queryFn: reportsApi.bot, enabled: tab === "bot" });
  const { data: attendance } = useQuery({ queryKey: ["reportsAttendance"], queryFn: reportsApi.attendance, enabled: tab === "attendance" });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Relatórios</h1>
        <div className="flex gap-2">
          <button onClick={() => downloadCsv("campaigns")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
            Exportar campanhas
          </button>
          <button onClick={() => downloadCsv("messages")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
            Exportar mensagens
          </button>
          <button onClick={() => downloadCsv("contacts")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
            Exportar contatos
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2 border-b border-slate-200">
        {(["campaigns", "bot", "attendance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-500"}`}
          >
            {t === "campaigns" ? "Campanhas" : t === "bot" ? "Bot" : "Atendimento"}
          </button>
        ))}
      </div>

      {tab === "campaigns" && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Enviadas</th>
                <th className="px-4 py-2">Falhas</th>
              </tr>
            </thead>
            <tbody>
              {campaigns?.map((c: any) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">{c.status}</td>
                  <td className="px-4 py-2">{c.totalCount}</td>
                  <td className="px-4 py-2">{c.sentCount}</td>
                  <td className="px-4 py-2">{c.failedCount}</td>
                </tr>
              ))}
              {campaigns?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma campanha ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bot" && bot && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Fluxos publicados" value={bot.flowCount} />
          <Stat label="Sessões concluídas" value={bot.done} />
          <Stat label="Taxa de transbordo" value={`${(bot.transferRate * 100).toFixed(0)}%`} />
          <Stat label="Sessões ativas" value={bot.active} />
        </div>
      )}

      {tab === "attendance" && attendance && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Conversas totais" value={attendance.totalConversations} />
          <Stat label="Resolvidas" value={attendance.resolvedCount} />
          <Stat label="TMA (min)" value={attendance.tmaMinutes.toFixed(1)} />
          <Stat label="TME (min)" value={attendance.tmeMinutes.toFixed(1)} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-2xl font-semibold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
