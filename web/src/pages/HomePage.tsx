import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-100">
      <h1 className="text-2xl font-bold text-slate-900">Bem-vindo, {user?.name}!</h1>
      <p className="text-slate-500">A listagem de pipes chega em breve.</p>
      <Button variant="secondary" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
