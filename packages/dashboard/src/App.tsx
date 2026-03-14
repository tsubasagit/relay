import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuthContext } from "./components/AuthProvider";
import Login from "./pages/Login";
import OrgSelect from "./pages/OrgSelect";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import TemplateEditor from "./pages/TemplateEditor";
import Logs from "./pages/Logs";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import OrgSettings from "./pages/OrgSettings";
import Domains from "./pages/Domains";
import SendingAddresses from "./pages/SendingAddresses";
import Providers from "./pages/Providers";
import Contacts from "./pages/Contacts";
import Audiences from "./pages/Audiences";
import AudienceDetail from "./pages/AudienceDetail";
import Broadcasts from "./pages/Broadcasts";
import BroadcastComposer from "./pages/BroadcastComposer";
import BroadcastDetail from "./pages/BroadcastDetail";
import Webhooks from "./pages/Webhooks";
import Compose from "./pages/Compose";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireOrg({ children }: { children: React.ReactNode }) {
  const { currentOrg, loading } = useAuthContext();

  if (loading) return null;

  if (!currentOrg) {
    return <Navigate to="/orgs" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/orgs"
        element={
          <RequireAuth>
            <OrgSelect />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <RequireOrg>
              <Layout />
            </RequireOrg>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="/lists/:id" element={<ListDetail />} />
        <Route path="/audiences" element={<Audiences />} />
        <Route path="/audiences/:id" element={<AudienceDetail />} />
        <Route path="/broadcasts" element={<Broadcasts />} />
        <Route path="/broadcasts/new" element={<BroadcastComposer />} />
        <Route path="/broadcasts/:id" element={<BroadcastDetail />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/new" element={<TemplateEditor />} />
        <Route path="/templates/:id" element={<TemplateEditor />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings/keys" element={<Settings />} />
        <Route path="/settings/org" element={<OrgSettings />} />
        <Route path="/settings/domains" element={<Domains />} />
        <Route path="/settings/addresses" element={<SendingAddresses />} />
        <Route path="/settings/providers" element={<Providers />} />
        <Route path="/settings/webhooks" element={<Webhooks />} />
      </Route>
    </Routes>
  );
}
