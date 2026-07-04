import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactsApi } from "../api/contacts";
import { channelsApi } from "../api/channels";
import { simulatorApi } from "../api/simulator";

export default function Simulator() {
  const queryClient = useQueryClient();
  const { data: contacts } = useQuery({ queryKey: ["contacts", ""], queryFn: () => contactsApi.list() });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: channelsApi.list });

  const [contactId, setContactId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [text, setText] = useState("");

  const { data: contact } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => contactsApi.get(contactId),
    enabled: !!contactId,
  });

  const sendMutation = useMutation({
    mutationFn: simulatorApi.sendInbound,
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contactId || !channelId || !text) return;
    sendMutation.mutate({ contactId, channelId, text });
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Simulador — seja o cliente</h1>
      <p className="mt-1 text-sm text-slate-500">
        Envie mensagens como se fosse o contato, para testar bot, atendimento e opt-out ("SAIR").
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">Selecione o contato…</option>
          {contacts?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          <option value="">Selecione o canal…</option>
          {channels?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        {!contact && <p className="text-sm text-slate-400">Selecione um contato para ver a conversa.</p>}
        {contact?.timeline
          ?.slice()
          .reverse()
          .map((m: any) => (
            <div key={m.id} className={`mb-2 flex ${m.direction === "IN" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                  m.direction === "IN" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {JSON.parse(m.body)?.text}
                <div className="mt-1 text-[10px] opacity-70">{m.status}</div>
              </div>
            </div>
          ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder='Digite como o cliente (ex.: "SAIR" para descadastro)'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={sendMutation.isPending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Enviar
        </button>
      </form>
      {sendMutation.data?.optedOut && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Contato descadastrado (opt-out) deste canal.
        </p>
      )}
    </div>
  );
}
