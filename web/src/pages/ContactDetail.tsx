import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactsApi } from "../api/contacts";
import { useAuth } from "../auth/AuthContext";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManageOwner = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => contactsApi.get(id!),
    enabled: !!id,
  });
  const { data: owners } = useQuery({
    queryKey: ["contactOwners"],
    queryFn: contactsApi.listOwners,
    enabled: canManageOwner,
  });

  const ownerMutation = useMutation({
    mutationFn: (ownerId: string | null) => contactsApi.update(id!, { ownerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  if (isLoading) return <div className="p-8 text-slate-500">Carregando…</div>;
  if (!contact) return <div className="p-8 text-slate-500">Contato não encontrado.</div>;

  return (
    <div className="p-8">
      <Link to="/contacts" className="text-sm text-brand-600 hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">{contact.name}</h1>
      <p className="text-sm text-slate-500">
        {contact.phone ?? "sem telefone"} · {contact.email ?? "sem e-mail"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-700">Dono (carteira)</h2>
          {canManageOwner ? (
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={contact.ownerId ?? ""}
              onChange={(e) => ownerMutation.mutate(e.target.value || null)}
              disabled={ownerMutation.isPending}
            >
              <option value="">Sem dono</option>
              {owners?.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-2 text-sm text-slate-600">{contact.owner?.name ?? "Sem dono"}</p>
          )}

          <h2 className="mt-4 text-sm font-semibold text-slate-700">Atributos</h2>
          <dl className="mt-2 space-y-1">
            {contact.attributeValues?.length === 0 && <p className="text-sm text-slate-400">Nenhum atributo.</p>}
            {contact.attributeValues?.map((av: any) => (
              <div key={av.id} className="flex justify-between text-sm">
                <dt className="text-slate-500">{av.def.name}</dt>
                <dd className="font-medium text-slate-800">{av.value}</dd>
              </div>
            ))}
          </dl>

          {contact.optOuts?.length > 0 && (
            <div className="mt-4 rounded bg-red-50 p-2 text-xs text-red-700">
              Opt-out: {contact.optOuts.map((o: any) => o.channelType).join(", ")}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700">Linha do tempo</h2>
          {contact.timeline?.length === 0 && <p className="mt-2 text-sm text-slate-400">Sem mensagens ainda.</p>}
          <ul className="mt-2 space-y-2">
            {contact.timeline?.map((m: any) => (
              <li key={m.id} className="rounded border border-slate-100 p-2 text-sm">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>
                    {m.direction === "OUT" ? "Enviada" : "Recebida"} · {m.channelType}
                  </span>
                  <span>{m.status}</span>
                </div>
                <div>{JSON.parse(m.body)?.text}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
