import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { reportsApi } from "../api/reports";

export default function Dashboard() {
  const { user, account } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["reportsDashboard"], queryFn: reportsApi.dashboard });

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Bem-vindo(a), {user?.name} — conta {account?.name}.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-400">Carregando…</p>}

      {data && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Saldo de créditos" value={data.balance.toFixed(1)} highlight={data.lowBalance} />
            <Stat label="Conversas abertas" value={data.openConversations} />
            <Stat label="Taxa de entrega" value={`${(data.deliveryRate * 100).toFixed(0)}%`} />
            <Stat label="Taxa de leitura" value={`${(data.readRate * 100).toFixed(0)}%`} />
          </div>

          {data.lowBalance && (
            <div className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Saldo de créditos baixo — considere fazer uma recarga em Créditos.
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Mensagens por canal (últimos 14 dias)</h2>
            <div className="mt-2 flex gap-6">
              {Object.entries(data.messagesByChannel).length === 0 && (
                <p className="text-sm text-slate-400">Nenhuma mensagem no período.</p>
              )}
              {Object.entries(data.messagesByChannel).map(([channel, count]) => (
                <div key={channel} className="text-sm">
                  <span className="font-semibold text-slate-800">{count}</span>{" "}
                  <span className="text-slate-500">{channel}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Mensagens por dia</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              {Object.entries(data.messagesByDay)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([day, count]) => (
                  <div key={day} className="rounded border border-slate-100 px-2 py-1 text-xs">
                    <div className="font-semibold text-slate-700">{count}</div>
                    <div className="text-slate-400">{day}</div>
                  </div>
                ))}
              {Object.entries(data.messagesByDay).length === 0 && <p className="text-sm text-slate-400">Sem dados ainda.</p>}
            </div>
          </div>
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
