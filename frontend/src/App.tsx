import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { queryClient } from "./lib/query-client";
import { RequireAuth } from "./routes/RequireAuth";
import { RequireOrgRole } from "./routes/RequireOrgRole";
import { AppShell } from "./layouts/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SuitesPage } from "./pages/SuitesPage";
import { RunsPage } from "./pages/RunsPage";
import { RunExecutionPage } from "./pages/RunExecutionPage";
import { BugsPage } from "./pages/BugsPage";
import { AuditPage } from "./pages/AuditPage";
import { MembersPage } from "./pages/MembersPage";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="suites" element={<SuitesPage />} />
              <Route path="runs" element={<RunsPage />} />
              <Route path="runs/:runId" element={<RunExecutionPage />} />
              <Route path="bugs" element={<BugsPage />} />
              <Route element={<RequireOrgRole minimum="ADMIN" />}>
                <Route path="audit" element={<AuditPage />} />
              </Route>
              <Route path="members" element={<MembersPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
