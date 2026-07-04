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
  const [tab, setTab] = useState<"dashboard" | "bot" | "attendance">("dashboard");
  const { data: dashboard } = useQuery({ queryKey: ["reportsDashboard"], queryFn: reportsApi.dashboard });
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
        {(["dashboard", "bot", "attendance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-500"}`}
          >
            {t === "dashboard" ? "Geral" : t === "bot" ? "Bot" : "Atendimento"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dashboard && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Saldo de créditos" value={dashboard.balance.toFixed(1)} highlight={dashboard.lowBalance} />
            <Stat label="Conversas abertas" value={dashboard.openConversations} />
            <Stat label="Taxa de entrega" value={`${(dashboard.deliveryRate * 100).toFixed(0)}%`} />
            <Stat label="Taxa de leitura" value={`${(dashboard.readRate * 100).toFixed(0)}%`} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Mensagens por canal (14 dias)</h2>
            <div className="mt-2 flex gap-4">
              {Object.entries(dashboard.messagesByChannel).map(([channel, count]) => (
                <div key={channel} className="text-sm">
                  <span className="font-semibold">{channel}:</span> {count}
                </div>
              ))}
            </div>
          </div>
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

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-semibold ${highlight ? "text-red-600" : "text-slate-800"}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
