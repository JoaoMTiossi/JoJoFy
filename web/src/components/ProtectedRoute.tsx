import { Navigate, Outlet } from "react-router-dom";
import { useAuth, Role } from "../auth/AuthContext";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { token, user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-500">Carregando…</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }
  return <Outlet />;
}
