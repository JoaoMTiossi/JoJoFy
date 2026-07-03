import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePipe } from "../api/queries";
import { Button } from "../components/ui/Button";
import { FieldsSettings } from "../components/settings/FieldsSettings";
import { LabelsSettings } from "../components/settings/LabelsSettings";
import { PhasesSettings } from "../components/settings/PhasesSettings";

type Tab = "fields" | "labels" | "phases";

export default function PipeSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: pipe, isLoading, isError } = usePipe(id);
  const [tab, setTab] = useState<Tab>("fields");

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-slate-500">Carregando...</div>;
  }
  if (isError || !pipe) {
    return <div className="flex flex-1 items-center justify-center text-red-600">Pipe não encontrado.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Configurações — {pipe.name}</h1>
        </div>
        <Link to={`/pipes/${pipe.id}`}>
          <Button variant="ghost">Voltar ao board</Button>
        </Link>
      </div>

      <div className="flex gap-1 border-b border-slate-200 bg-white px-6">
        {(
          [
            ["fields", "Campos"],
            ["labels", "Etiquetas"],
            ["phases", "Fases"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-3 text-sm font-medium ${
              tab === key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "fields" && <FieldsSettings pipe={pipe} />}
        {tab === "labels" && <LabelsSettings pipe={pipe} />}
        {tab === "phases" && <PhasesSettings pipe={pipe} />}
      </div>
    </div>
  );
}
