import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import type { Label, User } from "../../types";

export interface BoardFilterState {
  search: string;
  assigneeId: string;
  labelId: string;
  onlyOverdue: boolean;
}

export function BoardFilters({
  filters,
  onChange,
  users,
  labels,
}: {
  filters: BoardFilterState;
  onChange: (filters: BoardFilterState) => void;
  users: User[];
  labels: Label[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
      <Input
        placeholder="Buscar por título..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="max-w-xs"
      />

      <Select
        value={filters.assigneeId}
        onChange={(e) => onChange({ ...filters, assigneeId: e.target.value })}
        className="max-w-[180px]"
      >
        <option value="">Todos os responsáveis</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>

      <Select
        value={filters.labelId}
        onChange={(e) => onChange({ ...filters, labelId: e.target.value })}
        className="max-w-[180px]"
      >
        <option value="">Todas as etiquetas</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={filters.onlyOverdue}
          onChange={(e) => onChange({ ...filters, onlyOverdue: e.target.checked })}
        />
        Somente atrasados
      </label>
    </div>
  );
}
