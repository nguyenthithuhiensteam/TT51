import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AiSettingsPage from "./pages/AiSettingsPage";
import ObjectiveBankPage from "./pages/ObjectiveBankPage";
import AnnualPlanListPage from "./pages/annual/AnnualPlanListPage";
import AnnualPlanEditorPage from "./pages/annual/AnnualPlanEditorPage";
import ThemePlanListPage from "./pages/theme/ThemePlanListPage";
import ThemePlanEditorPage from "./pages/theme/ThemePlanEditorPage";
import WeeklyPlanListPage from "./pages/weekly/WeeklyPlanListPage";
import WeeklyPlanEditorPage from "./pages/weekly/WeeklyPlanEditorPage";
import LessonPlanEditorPage from "./pages/lesson/LessonPlanEditorPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="ai-settings" element={<AiSettingsPage />} />
        <Route path="objectives" element={<ObjectiveBankPage />} />
        <Route path="annual-plans" element={<AnnualPlanListPage />} />
        <Route path="annual-plans/new" element={<AnnualPlanEditorPage />} />
        <Route path="annual-plans/:id" element={<AnnualPlanEditorPage />} />
        <Route path="theme-plans" element={<ThemePlanListPage />} />
        <Route path="theme-plans/new" element={<ThemePlanEditorPage />} />
        <Route path="theme-plans/:id" element={<ThemePlanEditorPage />} />
        <Route path="weekly-plans" element={<WeeklyPlanListPage />} />
        <Route path="weekly-plans/new" element={<WeeklyPlanEditorPage />} />
        <Route path="weekly-plans/:id" element={<WeeklyPlanEditorPage />} />
        <Route path="lesson-plans/:id" element={<LessonPlanEditorPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
