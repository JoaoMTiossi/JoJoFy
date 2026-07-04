import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { campaignsApi } from "../api/campaigns";

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => campaignsApi.get(id!),
    enabled: !!id,
    refetchInterval: 3000,
  });

  if (isLoading) return <div className="p-8 text-slate-500">Carregando…</div>;
  if (!data) return <div className="p-8 text-slate-500">Campanha não encontrada.</div>;

  const { campaign, totalRecipients, skipped, variantCounts, messagesByStatus, totalMessages } = data;

  return (
    <div className="p-8">
      <Link to="/campaigns" className="text-sm text-brand-600 hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">{campaign.name}</h1>
      <p className="text-sm text-slate-500">
        {campaign.channelType} · {campaign.status}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Destinatários" value={totalRecipients} />
        <Stat label="Ignorados (opt-out)" value={skipped} />
        <Stat label="Mensagens totais" value={totalMessages} />
        <Stat label="Variante A / B" value={`${variantCounts.A} / ${variantCounts.B}`} />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Status das mensagens</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"].map((status) => (
            <div key={status} className="rounded border border-slate-100 p-2 text-center">
              <div className="text-lg font-semibold text-slate-800">{messagesByStatus[status] ?? 0}</div>
              <div className="text-xs text-slate-400">{status}</div>
            </div>
          ))}
        </div>
      </div>
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
