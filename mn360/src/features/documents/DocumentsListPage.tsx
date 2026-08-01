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
import {
  createDocument,
  listDocuments,
  type DocumentWithCreator,
} from "@/lib/db/documentRepo";
import type { DocumentType, RecordStatus } from "@/lib/db/types";
import { DOC_TYPE_LABELS, STATUS_LABELS } from "@/lib/db/types";
import { DocumentFormModal } from "./DocumentFormModal";
import type { DocumentFormInput } from "../../lib/schemas/document";

const PAGE_SIZE = 10;

export function DocumentsListPage() {
  const user = useAuthStore((s) => s.user);
  const sessionId = useAuthStore((s) => s.sessionId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const schoolYear = useAppStore((s) => s.currentSchoolYear);

  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState<DocumentType | "all">("all");
  const [status, setStatus] = useState<RecordStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DocumentWithCreator[]>([]);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    listDocuments({ search, docType, status, page, pageSize: PAGE_SIZE }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, docType, status, page]);

  async function handleCreate(data: DocumentFormInput) {
    if (!schoolYear || !user) return;
    setSubmitting(true);
    try {
      await createDocument({
        schoolYearId: schoolYear.id,
        docType: data.docType,
        title: data.title,
        summary: data.summary,
        issuingUnit: data.issuingUnit,
        recipient: data.recipient,
        category: data.category,
        contentHtml: data.contentHtml,
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
          <h1 className="text-xl font-semibold text-navy">Văn phòng số</h1>
          <p className="text-sm text-navy/60">
            Soạn thảo → Gửi duyệt → Góp ý → Hoàn thiện → Ký → Ban hành → Lưu trữ
          </p>
        </div>
        {hasPermission("document.create") && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Soạn thảo văn bản
          </Button>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
            <Input
              className="pl-9"
              placeholder="Tìm theo tiêu đề hoặc số hiệu"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="w-48"
            value={docType}
            onChange={(e) => {
              setDocType(e.target.value as DocumentType | "all");
              setPage(1);
            }}
          >
            <option value="all">Tất cả loại văn bản</option>
            {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50">
                <th className="pb-2 font-medium">Số hiệu</th>
                <th className="pb-2 font-medium">Tiêu đề</th>
                <th className="pb-2 font-medium">Loại</th>
                <th className="pb-2 font-medium">Người soạn</th>
                <th className="pb-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-navy/5 hover:bg-navy/5">
                  <td className="py-2 font-mono text-xs text-navy/60">{d.code}</td>
                  <td className="py-2">
                    <Link
                      to={`/van-phong-so/${d.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {d.title}
                    </Link>
                  </td>
                  <td className="py-2">{DOC_TYPE_LABELS[d.doc_type]}</td>
                  <td className="py-2">{d.created_by_name}</td>
                  <td className="py-2">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-navy/50">
                    Không có văn bản nào phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </Card>

      <DocumentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
      />
    </div>
  );
}
