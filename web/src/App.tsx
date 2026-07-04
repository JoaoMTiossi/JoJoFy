import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Audiences from "./pages/Audiences";
import Templates from "./pages/Templates";
import Simulator from "./pages/Simulator";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Journeys from "./pages/Journeys";
import JourneyDetail from "./pages/JourneyDetail";
import Flows from "./pages/Flows";
import FlowCanvas from "./pages/FlowCanvas";
import ApiKeys from "./pages/settings/ApiKeys";
import ChannelsSettings from "./pages/settings/Channels";
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
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/audiences" element={<Audiences />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/journeys" element={<Journeys />} />
          <Route path="/journeys/:id" element={<JourneyDetail />} />
          <Route path="/flows" element={<Flows />} />
          <Route path="/flows/:id" element={<FlowCanvas />} />
          <Route path="/inbox" element={<Stub title="Inbox" />} />
          <Route path="/supervision" element={<Stub title="Supervisão" />} />
          <Route path="/settings/channels" element={<ChannelsSettings />} />
          <Route path="/settings/api-keys" element={<ApiKeys />} />
          <Route path="/settings/team" element={<Stub title="Equipe" />} />
          <Route path="/billing" element={<Stub title="Créditos" />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/reports" element={<Stub title="Relatórios" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
