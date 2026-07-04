import { useQuery } from "@tanstack/react-query";
import { supervisionApi } from "../api/supervision";

export default function Supervision() {
  const { data } = useQuery({ queryKey: ["supervision"], queryFn: supervisionApi.get, refetchInterval: 5000 });

  if (!data) return <div className="p-8 text-slate-500">Carregando…</div>;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Supervisão</h1>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat label="Conversas em curso" value={data.conversations.length} />
        <Stat label="SLA estourado" value={data.slaOverdueCount} highlight={data.slaOverdueCount > 0} />
        <Stat label="Agentes" value={data.agents.length} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Filas</h2>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th>Nome</th>
                <th>Estratégia</th>
                <th>Limite/agente</th>
                <th>Membros</th>
              </tr>
            </thead>
            <tbody>
              {data.queues.map((q) => (
                <tr key={q.id} className="border-t border-slate-100">
                  <td className="py-1">{q.name}</td>
                  <td>{q.strategy}</td>
                  <td>{q.maxPerAgent}</td>
                  <td>{q.memberCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Agentes</h2>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th>Conversas ativas</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-1">{a.name}</td>
                  <td>{a.status}</td>
                  <td>{a.activeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Conversas em curso</h2>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th>Contato</th>
              <th>Fila</th>
              <th>Agente</th>
              <th>Status</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {data.conversations.map((c: any) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-1">{c.contact.name}</td>
                <td>{c.queue?.name ?? "—"}</td>
                <td>{c.agent?.name ?? "não atribuído"}</td>
                <td>{c.status}</td>
                <td>{c.slaOverdue ? <span className="text-red-600">estourado</span> : "ok"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-semibold ${highlight ? "text-red-600" : "text-slate-800"}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
