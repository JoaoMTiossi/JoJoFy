import type { Activity } from "../../types";

function formatDate(date: string): string {
  return new Date(date).toLocaleString("pt-BR");
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma atividade registrada ainda.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((activity) => (
        <li key={activity.id} className="text-sm">
          <span className="font-medium text-slate-800">{activity.actorName}</span>{" "}
          <span className="text-slate-600">{activity.detail}</span>
          <div className="text-xs text-slate-400">{formatDate(activity.createdAt)}</div>
        </li>
      ))}
    </ul>
  );
}
