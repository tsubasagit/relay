import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { getApiKey } from "./lib/api";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import TemplateEditor from "./pages/TemplateEditor";
import Logs from "./pages/Logs";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

function RequireApiKey({ children }: { children: React.ReactNode }) {
  if (!getApiKey()) {
    return <Navigate to="/settings" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <RequireApiKey>
              <Dashboard />
            </RequireApiKey>
          }
        />
        <Route
          path="/templates"
          element={
            <RequireApiKey>
              <Templates />
            </RequireApiKey>
          }
        />
        <Route
          path="/templates/new"
          element={
            <RequireApiKey>
              <TemplateEditor />
            </RequireApiKey>
          }
        />
        <Route
          path="/templates/:id"
          element={
            <RequireApiKey>
              <TemplateEditor />
            </RequireApiKey>
          }
        />
        <Route
          path="/logs"
          element={
            <RequireApiKey>
              <Logs />
            </RequireApiKey>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireApiKey>
              <Analytics />
            </RequireApiKey>
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
