import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "./Avatar";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <aside className="flex w-14 flex-col items-center gap-4 border-r border-slate-200 bg-white py-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white"
          title="JoJoFy"
        >
          J
        </Link>
        <div className="flex-1" />
        {user && (
          <button
            type="button"
            onClick={logout}
            title={`Sair (${user.name})`}
            className="flex flex-col items-center gap-1 pb-2"
          >
            <Avatar name={user.name} size={28} />
          </button>
        )}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
