import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { journeysApi, JourneyStep } from "../api/journeys";
import { channelsApi } from "../api/channels";
import { templatesApi } from "../api/templates";

export default function JourneyDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: journey } = useQuery({ queryKey: ["journey", id], queryFn: () => journeysApi.get(id!), enabled: !!id });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: channelsApi.list });
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: () => templatesApi.list() });

  const [steps, setSteps] = useState<JourneyStep[]>([]);

  useEffect(() => {
    if (journey) setSteps(journey.definition.steps);
  }, [journey?.id]);

  const saveMutation = useMutation({
    mutationFn: () => journeysApi.update(id!, { definition: { steps } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey", id] }),
  });
  const activateMutation = useMutation({
    mutationFn: () => journeysApi.activate(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey", id] }),
  });

  function addStep(type: JourneyStep["type"]) {
    if (type === "send") setSteps((s) => [...s, { type: "send", templateId: "", channelId: channels?.[0]?.id ?? "" }]);
    if (type === "wait") setSteps((s) => [...s, { type: "wait", durationMs: 24 * 60 * 60 * 1000 }]);
    if (type === "condition")
      setSteps((s) => [
        ...s,
        { type: "condition", conditionType: "replied", ifTrueStepIndex: s.length + 1, ifFalseStepIndex: s.length + 1 },
      ]);
  }

  function updateStep(idx: number, patch: Partial<JourneyStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? ({ ...s, ...patch } as JourneyStep) : s)));
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  if (!journey) return <div className="p-8 text-slate-500">Carregando…</div>;

  return (
    <div className="p-8">
      <Link to="/journeys" className="text-sm text-brand-600 hover:underline">
        ← Voltar
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{journey.name}</h1>
        <div className="flex gap-2">
          <button onClick={() => saveMutation.mutate()} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            Salvar passos
          </button>
          {journey.status !== "ACTIVE" && (
            <button onClick={() => activateMutation.mutate()} className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700">
              Ativar jornada
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex gap-4 text-sm text-slate-500">
        <span>Status: {journey.status}</span>
        <span>Contatos: {journey.runsSummary.total}</span>
        <span>Em execução: {journey.runsSummary.running}</span>
        <span>Concluídos: {journey.runsSummary.done}</span>
        <span>Responderam: {journey.runsSummary.replied}</span>
      </div>

      <div className="mt-6 space-y-3">
        {steps.map((step, idx) => (
          <div key={idx} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Passo {idx}: {step.type}
              </span>
              <button onClick={() => removeStep(idx)} className="text-xs text-red-600 hover:underline">
                remover
              </button>
            </div>

            {step.type === "send" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <select className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={step.channelId} onChange={(e) => updateStep(idx, { channelId: e.target.value })}>
                  {channels?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={step.templateId} onChange={(e) => updateStep(idx, { templateId: e.target.value })}>
                  <option value="">Template…</option>
                  {templates?.filter((t) => t.channelId === step.channelId).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {step.type === "wait" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  value={step.durationMs / (60 * 60 * 1000)}
                  onChange={(e) => updateStep(idx, { durationMs: Number(e.target.value) * 60 * 60 * 1000 })}
                />
                <span className="text-sm text-slate-500">horas de espera</span>
              </div>
            )}

            {step.type === "condition" && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span>Se o contato respondeu, vá para o passo</span>
                <input
                  type="number"
                  className="w-16 rounded-md border border-slate-300 px-2 py-1"
                  value={step.ifTrueStepIndex}
                  onChange={(e) => updateStep(idx, { ifTrueStepIndex: Number(e.target.value) })}
                />
                <span>senão, vá para o passo</span>
                <input
                  type="number"
                  className="w-16 rounded-md border border-slate-300 px-2 py-1"
                  value={step.ifFalseStepIndex}
                  onChange={(e) => updateStep(idx, { ifFalseStepIndex: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={() => addStep("send")} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
          + Enviar mensagem
        </button>
        <button onClick={() => addStep("wait")} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
          + Esperar
        </button>
        <button onClick={() => addStep("condition")} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
          + Condição (respondeu?)
        </button>
      </div>
    </div>
  );
}
