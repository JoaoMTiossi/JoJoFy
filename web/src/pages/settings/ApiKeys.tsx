import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiKeysApi } from "../../api/apikeys";

const SCOPES = ["messages:send", "messages:read"];

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const { data: keys } = useQuery({ queryKey: ["apiKeys"], queryFn: apiKeysApi.list });
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["messages:send"]);
  const [newKey, setNewKey] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: apiKeysApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      setNewKey(data.key);
      setName("");
    },
  });
  const revokeMutation = useMutation({
    mutationFn: apiKeysApi.revoke,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apiKeys"] }),
  });

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, scopes });
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Chaves de API</h1>

      {newKey && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Copie sua chave agora — ela não será mostrada novamente:</p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1">{newKey}</code>
          <button className="mt-2 text-xs text-brand-700 hover:underline" onClick={() => setNewKey(null)}>
            Ok, já copiei
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nome da chave"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {SCOPES.map((scope) => (
          <label key={scope} className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
            {scope}
          </label>
        ))}
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Gerar chave</button>
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Prefixo</th>
              <th className="px-4 py-2">Escopos</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {keys?.map((k) => (
              <tr key={k.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{k.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{k.keyPrefix}…</td>
                <td className="px-4 py-2">{k.scopes.join(", ")}</td>
                <td className="px-4 py-2">{k.revoked ? "Revogada" : "Ativa"}</td>
                <td className="px-4 py-2">
                  {!k.revoked && (
                    <button onClick={() => revokeMutation.mutate(k.id)} className="text-xs text-red-600 hover:underline">
                      Revogar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
