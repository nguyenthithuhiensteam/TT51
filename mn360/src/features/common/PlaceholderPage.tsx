import { Card } from "../../components/ui/Card";

export function PlaceholderPage({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-navy">{title}</h1>
      <p className="mb-4 text-sm text-navy/60">
        Phân hệ này thuộc phạm vi {phase} theo lộ trình dự án — xem chi tiết trong{" "}
        <code>docs/ROADMAP.md</code>.
      </p>
      <Card className="text-sm text-navy/70">
        Dữ liệu và nghiệp vụ của phân hệ "{title}" chưa được triển khai ở bản hiện tại. Sơ đồ dữ
        liệu định hướng đã có sẵn trong <code>docs/DATA_MODEL.md</code> để tiếp tục xây dựng ở
        giai đoạn kế tiếp.
      </Card>
    </div>
  );
}
