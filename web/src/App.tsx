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
import Inbox from "./pages/Inbox";
import Supervision from "./pages/Supervision";
import Reports from "./pages/Reports";
import Billing from "./pages/Billing";
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
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/inbox" element={<Inbox />} />

          <Route element={<ProtectedRoute roles={["ADMIN", "MANAGER"]} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/audiences" element={<Audiences />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/journeys" element={<Journeys />} />
            <Route path="/journeys/:id" element={<JourneyDetail />} />
            <Route path="/flows" element={<Flows />} />
            <Route path="/flows/:id" element={<FlowCanvas />} />
            <Route path="/supervision" element={<Supervision />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
            <Route path="/billing" element={<Billing />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/settings/channels" element={<ChannelsSettings />} />
            <Route path="/settings/team" element={<Stub title="Equipe" />} />
          </Route>

          <Route element={<ProtectedRoute roles={["ADMIN", "DEVELOPER"]} />}>
            <Route path="/settings/api-keys" element={<ApiKeys />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
