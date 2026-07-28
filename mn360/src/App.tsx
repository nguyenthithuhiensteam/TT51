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
import { PlaceholderPage } from "./features/common/PlaceholderPage";

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
                <PlaceholderPage title="Trẻ em" phase="Giai đoạn 2" />
              </RequirePermission>
            }
          />
          <Route
            path="doi-ngu"
            element={
              <RequirePermission permission="staff.view">
                <PlaceholderPage title="Đội ngũ" phase="Giai đoạn 2" />
              </RequirePermission>
            }
          />
          <Route
            path="chuyen-mon"
            element={
              <RequirePermission permission="curriculum.view">
                <PlaceholderPage title="Chuyên môn" phase="Giai đoạn 2" />
              </RequirePermission>
            }
          />
          <Route
            path="nuoi-duong"
            element={
              <RequirePermission permission="nutrition.view">
                <PlaceholderPage title="Nuôi dưỡng" phase="Giai đoạn 3" />
              </RequirePermission>
            }
          />
          <Route
            path="suc-khoe-an-toan"
            element={
              <RequirePermission permission="health.view">
                <PlaceholderPage title="Sức khỏe – An toàn" phase="Giai đoạn 3" />
              </RequirePermission>
            }
          />
          <Route
            path="tai-chinh-tai-san"
            element={
              <RequirePermission permission="finance.view">
                <PlaceholderPage title="Tài chính – Tài sản" phase="Giai đoạn 3" />
              </RequirePermission>
            }
          />
          <Route
            path="kiem-dinh"
            element={
              <RequirePermission permission="accreditation.view">
                <PlaceholderPage title="Kiểm định" phase="Giai đoạn 4" />
              </RequirePermission>
            }
          />
          <Route
            path="cong-tac-dang"
            element={
              <RequirePermission permission="party.view">
                <PlaceholderPage title="Công tác Đảng" phase="Giai đoạn 4" />
              </RequirePermission>
            }
          />
          <Route
            path="phu-huynh"
            element={
              <RequirePermission permission="parent.view">
                <PlaceholderPage title="Phụ huynh" phase="Giai đoạn 4" />
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
