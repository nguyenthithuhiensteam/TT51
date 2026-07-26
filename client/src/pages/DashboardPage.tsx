import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { annualPlansApi, lessonPlansApi, themePlansApi, weeklyPlansApi } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS } from "../types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ annual: number; theme: number; weekly: number; lesson: number } | null>(null);

  useEffect(() => {
    Promise.all([annualPlansApi.list(), themePlansApi.list(), weeklyPlansApi.list(), lessonPlansApi.list()]).then(
      ([annual, theme, weekly, lesson]) => setCounts({ annual: annual.length, theme: theme.length, weekly: weekly.length, lesson: lesson.length })
    );
  }, []);

  return (
    <div>
      <h2>Xin chào, {user?.fullName} ({user && ROLE_LABELS[user.role]})</h2>
      <p className="muted">Quản lý kế hoạch giáo dục mầm non: kế hoạch năm, chủ đề, tuần và giáo án hằng ngày, có hỗ trợ AI.</p>
      <div className="row" style={{ marginTop: 16 }}>
        <Link className="card" to="/annual-plans" style={{ flex: 1, textDecoration: "none" }}>
          <h3 style={{ marginTop: 0 }}>Kế hoạch giáo dục năm</h3>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{counts?.annual ?? "-"}</div>
        </Link>
        <Link className="card" to="/theme-plans" style={{ flex: 1, textDecoration: "none" }}>
          <h3 style={{ marginTop: 0 }}>Kế hoạch chủ đề/tháng</h3>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{counts?.theme ?? "-"}</div>
        </Link>
        <Link className="card" to="/weekly-plans" style={{ flex: 1, textDecoration: "none" }}>
          <h3 style={{ marginTop: 0 }}>Kế hoạch tuần</h3>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{counts?.weekly ?? "-"}</div>
        </Link>
        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ marginTop: 0 }}>Giáo án ngày</h3>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{counts?.lesson ?? "-"}</div>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Quy trình kế thừa dữ liệu</h3>
        <p className="muted">Kế hoạch năm → Kế hoạch chủ đề/tháng → Kế hoạch tuần → Giáo án từng ngày → Đánh giá và điều chỉnh.</p>
        <p className="muted">Trước khi tạo kế hoạch bằng AI, hãy kiểm tra kết nối AI trong mục "Cài đặt AI" và bảo đảm "Ngân hàng mục tiêu" đã có đủ mã mục tiêu cho độ tuổi cần dùng.</p>
      </div>
    </div>
  );
}
