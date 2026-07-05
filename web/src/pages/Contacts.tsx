import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactsApi } from "../api/contacts";
import { useAuth } from "../auth/AuthContext";

export default function Contacts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManageOwner = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwnerId, setBulkOwnerId] = useState("");

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", q],
    queryFn: () => contactsApi.list(q || undefined),
  });
  const { data: owners } = useQuery({
    queryKey: ["contactOwners"],
    queryFn: contactsApi.listOwners,
    enabled: canManageOwner,
  });

  const createMutation = useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setName("");
      setPhone("");
      setEmail("");
      setShowForm(false);
    },
  });

  const bulkOwnerMutation = useMutation({
    mutationFn: () => contactsApi.bulkOwner({ contactIds: [...selected], ownerId: bulkOwnerId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelected(new Set());
      setBulkOwnerId("");
    },
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (!contacts) return prev;
      if (prev.size === contacts.length) return new Set();
      return new Set(contacts.map((c) => c.id));
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, phone: phone || undefined, email: email || undefined });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Contatos</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Cancelar" : "Novo contato"}
        </button>
      </div>

      {user?.role === "AGENT" && (
        <p className="mt-2 text-xs text-slate-500">
          Você está vendo a sua carteira: contatos dos quais é dono, que está atendendo, ou aguardando nas suas filas.
        </p>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Salvar
          </button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Buscar por nome, telefone ou e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {canManageOwner && selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm">
            <span className="text-brand-700">{selected.size} selecionado(s)</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={bulkOwnerId}
              onChange={(e) => setBulkOwnerId(e.target.value)}
            >
              <option value="">Sem dono</option>
              {owners?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))}
            </select>
            <button
              onClick={() => bulkOwnerMutation.mutate()}
              disabled={bulkOwnerMutation.isPending}
              className="rounded-md bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Atribuir dono
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {canManageOwner && (
                <th className="w-8 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={!!contacts && contacts.length > 0 && selected.size === contacts.length}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Dono</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={canManageOwner ? 5 : 4} className="px-4 py-6 text-center text-slate-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && contacts?.length === 0 && (
              <tr>
                <td colSpan={canManageOwner ? 5 : 4} className="px-4 py-6 text-center text-slate-400">
                  Nenhum contato encontrado.
                </td>
              </tr>
            )}
            {contacts?.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                {canManageOwner && (
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelected(c.id)} />
                  </td>
                )}
                <td className="px-4 py-2">
                  <Link to={`/contacts/${c.id}`} className="text-brand-700 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.phone ?? "—"}</td>
                <td className="px-4 py-2">{c.email ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{c.owner?.name ?? "sem dono"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
