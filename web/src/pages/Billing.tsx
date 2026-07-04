import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../api/billing";

export default function Billing() {
  const queryClient = useQueryClient();
  const { data: balance } = useQuery({ queryKey: ["billingBalance"], queryFn: billingApi.balance });
  const { data: prices } = useQuery({ queryKey: ["billingPrices"], queryFn: billingApi.prices });
  const { data: ledger } = useQuery({ queryKey: ["billingLedger"], queryFn: billingApi.ledger });

  const [credits, setCredits] = useState(500);

  const rechargeMutation = useMutation({
    mutationFn: () => billingApi.recharge(credits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billingBalance"] });
      queryClient.invalidateQueries({ queryKey: ["billingLedger"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    rechargeMutation.mutate();
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Créditos e billing</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className={`text-2xl font-semibold ${balance?.lowBalance ? "text-red-600" : "text-slate-800"}`}>
            {balance?.balance?.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500">Saldo atual</div>
          {balance?.lowBalance && <div className="mt-1 text-xs text-red-600">Saldo baixo — considere recarregar.</div>}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Preços por canal</h2>
          {prices?.map((p) => (
            <div key={p.id} className="flex justify-between text-sm text-slate-600">
              <span>{p.channelType}</span>
              <span>{p.credits} créditos</span>
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Recarga (simulada)</h2>
          <input
            type="number"
            className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            min={1}
          />
          <button className="mt-2 w-full rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700">Recarregar</button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Motivo</th>
              <th className="px-4 py-2">Delta</th>
              <th className="px-4 py-2">Saldo após</th>
            </tr>
          </thead>
          <tbody>
            {ledger?.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{new Date(l.createdAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2">{l.reason}</td>
                <td className={`px-4 py-2 ${l.delta < 0 ? "text-red-600" : "text-emerald-600"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</td>
                <td className="px-4 py-2">{l.balanceAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
