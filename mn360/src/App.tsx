import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAuth, RequirePermission } from "./routes/guards";
import { LoginPage } from "./features/auth/LoginPage";
import { ChangePasswordPage } from "./features/auth/ChangePasswordPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";

const TasksListPage = lazy(() => import("./features/tasks/TasksListPage").then((m) => ({ default: m.TasksListPage })));
const TaskDetailPage = lazy(() => import("./features/tasks/TaskDetailPage").then((m) => ({ default: m.TaskDetailPage })));
const DocumentsListPage = lazy(() => import("./features/documents/DocumentsListPage").then((m) => ({ default: m.DocumentsListPage })));
const DocumentDetailPage = lazy(() => import("./features/documents/DocumentDetailPage").then((m) => ({ default: m.DocumentDetailPage })));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const BackupPage = lazy(() => import("./features/backup/BackupPage").then((m) => ({ default: m.BackupPage })));
const ChildrenPage = lazy(() => import("./features/children/ChildrenPage").then((m) => ({ default: m.ChildrenPage })));
const ChildDetailPage = lazy(() => import("./features/children/ChildDetailPage").then((m) => ({ default: m.ChildDetailPage })));
const StaffListPage = lazy(() => import("./features/staff/StaffListPage").then((m) => ({ default: m.StaffListPage })));
const StaffDetailPage = lazy(() => import("./features/staff/StaffDetailPage").then((m) => ({ default: m.StaffDetailPage })));
const EducationPlansListPage = lazy(() => import("./features/curriculum/EducationPlansListPage").then((m) => ({ default: m.EducationPlansListPage })));
const PlanDetailPage = lazy(() => import("./features/curriculum/PlanDetailPage").then((m) => ({ default: m.PlanDetailPage })));
const NutritionPage = lazy(() => import("./features/nutrition/NutritionPage").then((m) => ({ default: m.NutritionPage })));
const HealthSafetyPage = lazy(() => import("./features/health/HealthSafetyPage").then((m) => ({ default: m.HealthSafetyPage })));
const FinancePage = lazy(() => import("./features/finance/FinancePage").then((m) => ({ default: m.FinancePage })));
const AccreditationPage = lazy(() => import("./features/accreditation/AccreditationPage").then((m) => ({ default: m.AccreditationPage })));
const PartyPage = lazy(() => import("./features/party/PartyPage").then((m) => ({ default: m.PartyPage })));
const ParentPortalPage = lazy(() => import("./features/parent/ParentPortalPage").then((m) => ({ default: m.ParentPortalPage })));

function RouteLoading() {
  return (
    <div className="flex items-center justify-center p-12 text-sm text-navy/50">
      Đang tải...
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="doi-mat-khau" element={<ChangePasswordPage />} />
            <Route
              index
              element={
                <RequirePermission permission="dashboard.view">
                  <DashboardPage />
                </RequirePermission>
              }
            />
            <Route
              path="cong-viec"
              element={
                <RequirePermission permission="task.view">
                  <TasksListPage />
                </RequirePermission>
              }
            />
            <Route
              path="cong-viec/:id"
              element={
                <RequirePermission permission="task.view">
                  <TaskDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="van-phong-so"
              element={
                <RequirePermission permission="document.view">
                  <DocumentsListPage />
                </RequirePermission>
              }
            />
            <Route
              path="van-phong-so/:id"
              element={
                <RequirePermission permission="document.view">
                  <DocumentDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="tre-em"
              element={
                <RequirePermission permission="children.view">
                  <ChildrenPage />
                </RequirePermission>
              }
            />
            <Route
              path="tre-em/:id"
              element={
                <RequirePermission permission="children.view">
                  <ChildDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="doi-ngu"
              element={
                <RequirePermission permission="staff.view">
                  <StaffListPage />
                </RequirePermission>
              }
            />
            <Route
              path="doi-ngu/:id"
              element={
                <RequirePermission permission="staff.view">
                  <StaffDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="chuyen-mon"
              element={
                <RequirePermission permission="curriculum.view">
                  <EducationPlansListPage />
                </RequirePermission>
              }
            />
            <Route
              path="chuyen-mon/:id"
              element={
                <RequirePermission permission="curriculum.view">
                  <PlanDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="nuoi-duong"
              element={
                <RequirePermission permission="nutrition.view">
                  <NutritionPage />
                </RequirePermission>
              }
            />
            <Route
              path="suc-khoe-an-toan"
              element={
                <RequirePermission permission="health.view">
                  <HealthSafetyPage />
                </RequirePermission>
              }
            />
            <Route
              path="tai-chinh-tai-san"
              element={
                <RequirePermission permission="finance.view">
                  <FinancePage />
                </RequirePermission>
              }
            />
            <Route
              path="kiem-dinh"
              element={
                <RequirePermission permission="accreditation.view">
                  <AccreditationPage />
                </RequirePermission>
              }
            />
            <Route
              path="cong-tac-dang"
              element={
                <RequirePermission permission="party.view">
                  <PartyPage />
                </RequirePermission>
              }
            />
            <Route
              path="phu-huynh"
              element={
                <RequirePermission permission="parent.view">
                  <ParentPortalPage />
                </RequirePermission>
              }
            />
            <Route
              path="cai-dat"
              element={
                <RequirePermission permission="system.view">
                  <SettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="sao-luu"
              element={
                <RequirePermission permission="system.backup">
                  <BackupPage />
                </RequirePermission>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
