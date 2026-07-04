import { NavLink, Outlet } from "react-router-dom";
import { useAuth, Role } from "../auth/AuthContext";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", roles: ["ADMIN", "MANAGER"] },
  { to: "/contacts", label: "Contatos" },
  { to: "/audiences", label: "Audiências", roles: ["ADMIN", "MANAGER"] },
  { to: "/templates", label: "Templates", roles: ["ADMIN", "MANAGER"] },
  { to: "/campaigns", label: "Campanhas", roles: ["ADMIN", "MANAGER"] },
  { to: "/journeys", label: "Jornadas", roles: ["ADMIN", "MANAGER"] },
  { to: "/flows", label: "Chatbot", roles: ["ADMIN", "MANAGER"] },
  { to: "/inbox", label: "Inbox" },
  { to: "/supervision", label: "Supervisão", roles: ["ADMIN", "MANAGER"] },
  { to: "/reports", label: "Relatórios", roles: ["ADMIN", "MANAGER"] },
  { to: "/billing", label: "Créditos", roles: ["ADMIN"] },
  { to: "/simulator", label: "Simulador", roles: ["ADMIN"] },
  { to: "/settings/channels", label: "Canais", roles: ["ADMIN"] },
  { to: "/settings/api-keys", label: "API Keys", roles: ["ADMIN", "DEVELOPER"] },
  { to: "/settings/team", label: "Equipe", roles: ["ADMIN"] },
];

export default function AppLayout() {
  const { user, account, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-lg font-semibold text-brand-700">Zenvia Clone</div>
          <div className="text-xs text-slate-500">{account?.name}</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="text-sm font-medium text-slate-700">{user?.name}</div>
          <div className="text-xs text-slate-500">{user?.role}</div>
          <button onClick={logout} className="mt-2 text-xs text-brand-600 hover:underline">
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
