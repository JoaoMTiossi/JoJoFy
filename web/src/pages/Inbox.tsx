import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationsApi } from "../api/conversations";
import { quickRepliesApi } from "../api/quickReplies";
import { agentStatusApi } from "../api/agentStatus";
import { queuesApi } from "../api/queues";
import { contactsApi } from "../api/contacts";

type Filter = "mine" | "unassigned" | "all";

export default function Inbox() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("mine");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [tagText, setTagText] = useState("");

  const { data: agentStatus } = useQuery({ queryKey: ["agentStatus"], queryFn: agentStatusApi.get });
  const statusMutation = useMutation({
    mutationFn: agentStatusApi.set,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agentStatus"] }),
  });

  const { data: conversations } = useQuery({
    queryKey: ["conversations", filter],
    queryFn: () =>
      conversationsApi.list(
        filter === "mine" ? { mine: true } : filter === "unassigned" ? { unassigned: true, status: "OPEN" } : {}
      ),
    refetchInterval: 5000,
  });

  const { data: conversation } = useQuery({
    queryKey: ["conversation", selectedId],
    queryFn: () => conversationsApi.get(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 3000,
  });

  const { data: quickReplies } = useQuery({ queryKey: ["quickReplies"], queryFn: quickRepliesApi.list });
  const { data: queues } = useQuery({ queryKey: ["queues"], queryFn: queuesApi.list });
  const { data: contact } = useQuery({
    queryKey: ["contact", conversation?.contactId],
    queryFn: () => contactsApi.get(conversation!.contactId),
    enabled: !!conversation?.contactId,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["conversation", selectedId] });
  }

  const replyMutation = useMutation({
    mutationFn: () => conversationsApi.reply(selectedId!, text),
    onSuccess: () => {
      setText("");
      invalidateAll();
    },
  });
  const pullMutation = useMutation({ mutationFn: () => conversationsApi.pull(selectedId!), onSuccess: invalidateAll });
  const resolveMutation = useMutation({ mutationFn: () => conversationsApi.resolve(selectedId!), onSuccess: invalidateAll });
  const noteMutation = useMutation({
    mutationFn: () => conversationsApi.addNote(selectedId!, noteText),
    onSuccess: () => {
      setNoteText("");
      invalidateAll();
    },
  });
  const tagMutation = useMutation({
    mutationFn: () => conversationsApi.addTag(selectedId!, tagText),
    onSuccess: () => {
      setTagText("");
      invalidateAll();
    },
  });
  const transferMutation = useMutation({
    mutationFn: (queueId: string) => conversationsApi.transfer(selectedId!, { queueId }),
    onSuccess: invalidateAll,
  });

  function onSubmitReply(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) replyMutation.mutate();
  }

  return (
    <div className="grid h-full grid-cols-[280px_1fr_280px]">
      {/* Coluna 1: filas/conversas */}
      <div className="flex flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500">Meu status</span>
            <select
              className="rounded border border-slate-300 px-1 py-0.5"
              value={agentStatus?.status ?? "OFFLINE"}
              onChange={(e) => statusMutation.mutate(e.target.value as any)}
            >
              <option value="ONLINE">Online</option>
              <option value="AWAY">Ausente</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
          <div className="mt-2 flex gap-1 text-xs">
            {(["mine", "unassigned", "all"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded px-2 py-1 ${filter === f ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {f === "mine" ? "Minhas" : f === "unassigned" ? "Fila" : "Todas"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                selectedId === c.id ? "bg-brand-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{c.contact.name}</span>
                {c.slaOverdue && <span className="rounded bg-red-100 px-1 text-[10px] text-red-700">SLA</span>}
              </div>
              <div className="text-slate-400">
                {c.channelType} · {c.status}
              </div>
            </button>
          ))}
          {conversations?.length === 0 && <p className="p-3 text-xs text-slate-400">Nenhuma conversa aqui.</p>}
        </div>
      </div>

      {/* Coluna 2: chat */}
      <div className="flex flex-col">
        {!conversation && <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Selecione uma conversa.</div>}
        {conversation && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">{conversation.contact.name}</div>
                <div className="text-xs text-slate-400">
                  {conversation.channelType} · {conversation.status} {conversation.agent ? `· ${conversation.agent.name}` : "· sem agente"}
                </div>
              </div>
              <div className="flex gap-2">
                {!conversation.agentId && (
                  <button onClick={() => pullMutation.mutate()} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                    Puxar
                  </button>
                )}
                {conversation.status !== "RESOLVED" && (
                  <button onClick={() => resolveMutation.mutate()} className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">
                    Resolver
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
              {conversation.messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "IN" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-md rounded-lg px-3 py-2 text-sm ${m.direction === "IN" ? "bg-white text-slate-800" : "bg-brand-600 text-white"}`}>
                    {JSON.parse(m.body)?.text}
                    <div className="mt-1 text-[10px] opacity-70">
                      {m.source} · {m.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={onSubmitReply} className="border-t border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {quickReplies?.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setText(q.body)}
                    className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
                  >
                    /{q.shortcut}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Digite sua resposta…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={conversation.status === "RESOLVED"}
                />
                <button
                  type="submit"
                  disabled={conversation.status === "RESOLVED"}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Coluna 3: contexto do contato */}
      <div className="overflow-y-auto border-l border-slate-200 bg-white p-4">
        {!conversation && <p className="text-sm text-slate-400">—</p>}
        {conversation && contact && (
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-700">Contato</h3>
              <p className="text-slate-500">{contact.phone ?? contact.email}</p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-700">Atributos</h3>
              {contact.attributeValues?.map((av: any) => (
                <div key={av.id} className="flex justify-between text-xs">
                  <span className="text-slate-500">{av.def.name}</span>
                  <span>{av.value}</span>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-semibold text-slate-700">Transferir</h3>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                onChange={(e) => e.target.value && transferMutation.mutate(e.target.value)}
                defaultValue=""
              >
                <option value="">Selecionar fila…</option>
                {queues?.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="font-semibold text-slate-700">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {conversation.tags.map((t) => (
                  <span key={t.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {t.tag}
                  </span>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                <input className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="nova tag" />
                <button onClick={() => tagText && tagMutation.mutate()} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                  +
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-700">Notas internas</h3>
              <div className="space-y-1">
                {conversation.notes.map((n) => (
                  <div key={n.id} className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                    {n.body}
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                <input className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="nova nota" />
                <button onClick={() => noteText && noteMutation.mutate()} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
