import { useAuth } from "../auth/AuthContext";

export default function Dashboard() {
  const { user, account } = useAuth();
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-500">
        Bem-vindo(a), {user?.name} — conta {account?.name}.
      </p>
    </div>
  );
}
