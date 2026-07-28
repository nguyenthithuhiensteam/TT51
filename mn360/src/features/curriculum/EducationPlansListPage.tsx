import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Pagination } from "../../components/ui/Pagination";
import { StatusBadge } from "../../components/ui/Badge";
import { useAuthStore } from "../../store/authStore";
import { useAppStore } from "../../store/appStore";
import { createEducationPlan, listEducationPlans, type EducationPlanRow } from "../../lib/db/curriculumRepo";
import { listClasses, type ClassWithTeacher } from "../../lib/db/childRepo";
import { PLAN_TYPE_LABELS, STATUS_LABELS } from "../../lib/db/types";
import type { PlanType, RecordStatus } from "../../lib/db/types";
import { PlanFormModal, type PlanFormValues } from "./PlanFormModal";

const PAGE_SIZE = 10;

export function EducationPlansListPage() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [search, setSearch] = useState("");
  const [planType, setPlanType] = useState<PlanType | "all">("all");
  const [status, setStatus] = useState<RecordStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EducationPlanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    listEducationPlans({ search, planType, status, page, pageSize: PAGE_SIZE }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, planType, status, page]);

  useEffect(() => {
    if (schoolYear) listClasses(schoolYear.id).then(setClasses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear?.id]);

  async function handleCreate(data: PlanFormValues) {
    if (!schoolYear || !user) return;
    setSubmitting(true);
    try {
      await createEducationPlan({
        schoolYearId: schoolYear.id,
        classId: data.classId || undefined,
        planType: data.planType,
        title: data.title,
        ageGroup: data.ageGroup || undefined,
        periodStart: data.periodStart || undefined,
        periodEnd: data.periodEnd || undefined,
        objectives: data.objectives || undefined,
        requirements: data.requirements || undefined,
        content: data.content || undefined,
        createdBy: user.id,
        sessionId,
      });
      setModalOpen(false);
      setPage(1);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">Chuyên môn</h1>
          <p className="text-sm text-navy/60">
            Giáo viên soạn → Tổ trưởng góp ý → Phó hiệu trưởng duyệt → thực hiện → đánh giá → điều chỉnh
          </p>
        </div>
        {hasPermission("curriculum.create") && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Soạn kế hoạch
          </Button>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
            <Input
              className="pl-9"
              placeholder="Tìm theo tên hoặc mã kế hoạch"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="w-56"
            value={planType}
            onChange={(e) => {
              setPlanType(e.target.value as PlanType | "all");
              setPage(1);
            }}
          >
            <option value="all">Tất cả loại kế hoạch</option>
            {Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            className="w-48"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as RecordStatus | "all");
              setPage(1);
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-2 font-medium">Mã</th>
                <th className="pb-2 font-medium">Tên kế hoạch</th>
                <th className="pb-2 font-medium">Loại</th>
                <th className="pb-2 font-medium">Lớp</th>
                <th className="pb-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-navy/5 hover:bg-navy/5">
                  <td className="py-2 font-mono text-xs text-navy/60">{p.code}</td>
                  <td className="py-2">
                    <Link to={`/chuyen-mon/${p.id}`} className="font-medium text-brand hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="py-2">{PLAN_TYPE_LABELS[p.plan_type]}</td>
                  <td className="py-2">{p.class_name ?? "Toàn khối"}</td>
                  <td className="py-2">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-navy/50">
                    Không có kế hoạch nào phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </Card>

      <PlanFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        classes={classes}
        submitting={submitting}
      />
    </div>
  );
}
