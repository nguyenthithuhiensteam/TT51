import { HashRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAuth, RequirePermission } from "./routes/guards";
import { LoginPage } from "./features/auth/LoginPage";
import { ChangePasswordPage } from "./features/auth/ChangePasswordPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { TasksListPage } from "./features/tasks/TasksListPage";
import { TaskDetailPage } from "./features/tasks/TaskDetailPage";
import { DocumentsListPage } from "./features/documents/DocumentsListPage";
import { DocumentDetailPage } from "./features/documents/DocumentDetailPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { BackupPage } from "./features/backup/BackupPage";
import { ChildrenPage } from "./features/children/ChildrenPage";
import { ChildDetailPage } from "./features/children/ChildDetailPage";
import { StaffListPage } from "./features/staff/StaffListPage";
import { StaffDetailPage } from "./features/staff/StaffDetailPage";
import { EducationPlansListPage } from "./features/curriculum/EducationPlansListPage";
import { PlanDetailPage } from "./features/curriculum/PlanDetailPage";
import { NutritionPage } from "./features/nutrition/NutritionPage";
import { HealthSafetyPage } from "./features/health/HealthSafetyPage";
import { FinancePage } from "./features/finance/FinancePage";
import { AccreditationPage } from "./features/accreditation/AccreditationPage";
import { PartyPage } from "./features/party/PartyPage";
import { ParentPortalPage } from "./features/parent/ParentPortalPage";

export default function App() {
  return (
    <HashRouter>
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
    </HashRouter>
  );
}
