import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { channelsApi } from "../../api/channels";
import { webhooksApi } from "../../api/webhooks";

const EVENTS = ["message.status", "message.received", "contact.optout"];

export default function ChannelsSettings() {
  const queryClient = useQueryClient();
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: channelsApi.list });
  const { data: webhooks } = useQuery({ queryKey: ["webhooks"], queryFn: webhooksApi.list });

  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["message.status"]);

  const createMutation = useMutation({
    mutationFn: webhooksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setUrl("");
    },
  });
  const removeMutation = useMutation({
    mutationFn: webhooksApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  function toggleEvent(event: string) {
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Canais</h1>
      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {channels?.map((c) => (
          <li key={c.id} className="flex justify-between px-4 py-2 text-sm">
            <span>{c.name}</span>
            <span className="text-slate-400">{c.type}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-slate-800">Webhooks</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          createMutation.mutate({ url, events });
        }}
        className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="https://exemplo.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <div className="flex flex-wrap gap-3">
          {EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={events.includes(event)} onChange={() => toggleEvent(event)} />
              {event}
            </label>
          ))}
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Adicionar webhook
        </button>
      </form>

      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {webhooks?.map((w) => (
          <li key={w.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              <div>{w.url}</div>
              <div className="text-xs text-slate-400">{w.events}</div>
            </div>
            <button onClick={() => removeMutation.mutate(w.id)} className="text-xs text-red-600 hover:underline">
              Remover
            </button>
          </li>
        ))}
        {webhooks?.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">Nenhum webhook cadastrado.</li>}
      </ul>
    </div>
  );
}
