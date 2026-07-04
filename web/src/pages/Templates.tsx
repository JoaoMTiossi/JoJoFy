import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { templatesApi } from "../api/templates";
import { channelsApi } from "../api/channels";

export default function Templates() {
  const queryClient = useQueryClient();
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: channelsApi.list });
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: () => templatesApi.list() });

  const [channelId, setChannelId] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");

  const selectedChannel = channels?.find((c) => c.id === channelId);

  const createMutation = useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setName("");
      setBody("");
      setButtonLabel("");
      setSubject("");
      setHtml("");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      channelId,
      name,
      body,
      buttons: buttonLabel ? [{ label: buttonLabel }] : undefined,
      subject: subject || undefined,
      html: html || undefined,
    });
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Templates</h1>

      <form onSubmit={onSubmit} className="mt-4 max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          required
        >
          <option value="">Selecione o canal…</option>
          {channels?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nome do template"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <textarea
          className="h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Corpo da mensagem, use {{variavel}} para variáveis"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        {selectedChannel?.type === "WHATSAPP" && (
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Rótulo do botão (opcional)"
            value={buttonLabel}
            onChange={(e) => setButtonLabel(e.target.value)}
          />
        )}
        {selectedChannel?.type === "EMAIL" && (
          <>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Assunto do e-mail"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className="h-24 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              placeholder="HTML do e-mail (opcional)"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </>
        )}
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Criar template
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Canal</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Corpo</th>
            </tr>
          </thead>
          <tbody>
            {templates?.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2">{t.channelType}</td>
                <td className="px-4 py-2">
                  <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">{t.status}</span>
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-slate-500">{t.body}</td>
              </tr>
            ))}
            {templates?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Nenhum template criado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
