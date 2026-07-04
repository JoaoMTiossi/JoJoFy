import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Stub from "./components/Stub";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Stub title="Contatos" />} />
          <Route path="/contacts/:id" element={<Stub title="Perfil do contato" />} />
          <Route path="/audiences" element={<Stub title="Audiências" />} />
          <Route path="/templates" element={<Stub title="Templates" />} />
          <Route path="/campaigns" element={<Stub title="Campanhas" />} />
          <Route path="/campaigns/:id" element={<Stub title="Relatório da campanha" />} />
          <Route path="/journeys/:id" element={<Stub title="Jornada" />} />
          <Route path="/flows/:id" element={<Stub title="Chatbot" />} />
          <Route path="/inbox" element={<Stub title="Inbox" />} />
          <Route path="/supervision" element={<Stub title="Supervisão" />} />
          <Route path="/settings/channels" element={<Stub title="Canais" />} />
          <Route path="/settings/api-keys" element={<Stub title="API Keys" />} />
          <Route path="/settings/team" element={<Stub title="Equipe" />} />
          <Route path="/billing" element={<Stub title="Créditos" />} />
          <Route path="/simulator" element={<Stub title="Simulador" />} />
          <Route path="/reports" element={<Stub title="Relatórios" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
