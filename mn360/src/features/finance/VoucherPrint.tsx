import { useAppStore } from "../../store/appStore";
import { amountToVietnameseWordsVnd } from "../../lib/utils/vietnameseNumber";
import type { ExpenseRow, RevenueRow } from "@/lib/db/financeRepo";

function formatVnd(amount: number): string {
  return Math.round(amount).toLocaleString("vi-VN");
}

function formatDateParts(dateStr: string): { day: string; month: string; year: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: String(d.getMonth() + 1).padStart(2, "0"),
    year: String(d.getFullYear()),
  };
}

const printStyle = `
  @media print {
    body * { visibility: hidden; }
    #voucher-print-area, #voucher-print-area * { visibility: visible; }
    #voucher-print-area { position: absolute; left: 0; top: 0; width: 100%; }
    @page { size: A5 landscape; margin: 10mm; }
  }
`;

/**
 * In "Phiếu thu" (mẫu số C40-BB) hoặc "Phiếu chi" (mẫu số C41-BB) theo Thông tư 107/2017/TT-BTC.
 * Ô "Nợ"/"Có" (tài khoản kế toán) để trống cho kế toán ghi tay — MN360 không hạch toán sổ kép
 * nên không tự điền số hiệu tài khoản.
 */
export function VoucherPrint({ kind, record }: { kind: "thu" | "chi"; record: RevenueRow | ExpenseRow }) {
  const school = useAppStore((s) => s.school);
  const isThu = kind === "thu";
  const date = formatDateParts(isThu ? (record as RevenueRow).revenue_date : (record as ExpenseRow).expense_date);
  const payerName = isThu ? (record as RevenueRow).payer_name : (record as ExpenseRow).payee_name;
  const payerAddress = isThu ? (record as RevenueRow).payer_address : (record as ExpenseRow).payee_address;
  const reason = record.reason;
  const attachmentCount = record.attachment_count;
  const childName = isThu ? (record as RevenueRow).child_name : null;
  const feeItemName = isThu ? (record as RevenueRow).fee_item_name : null;
  const category = !isThu ? (record as ExpenseRow).category : null;

  return (
    <div>
      <style>{printStyle}</style>
      <div id="voucher-print-area" className="mx-auto max-w-3xl rounded-xl border border-navy/10 bg-white p-6 text-sm">
        <div className="mb-3 flex items-start justify-between text-xs">
          <div>
            <p className="font-semibold">Đơn vị: {school?.name ?? ""}</p>
            <p>Bộ phận: Kế toán</p>
          </div>
          <div className="text-right">
            <p>Mẫu số {isThu ? "C40-BB" : "C41-BB"}</p>
            <p className="italic">(Ban hành theo Thông tư số 107/2017/TT-BTC</p>
            <p className="italic">ngày 10/10/2017 của Bộ Tài chính)</p>
          </div>
        </div>

        <div className="mb-4 text-center">
          <p className="text-lg font-bold">{isThu ? "PHIẾU THU" : "PHIẾU CHI"}</p>
          <p>
            Ngày {date.day} tháng {date.month} năm {date.year}
          </p>
          <div className="mt-1 flex justify-center gap-6 text-xs">
            <span>Số: {record.code}</span>
            <span>Nợ: ..........................</span>
            <span>Có: ..........................</span>
          </div>
        </div>

        <div className="space-y-2">
          <p>
            Họ và tên người {isThu ? "nộp" : "nhận"} tiền: <strong>{payerName || "......................................."}</strong>
          </p>
          {childName && <p>(Của trẻ: {childName})</p>}
          <p>Địa chỉ: {payerAddress || "......................................."}</p>
          <p>
            Lý do {isThu ? "nộp" : "chi"}: {reason || feeItemName || category || "......................................."}
          </p>
          <p>
            Số tiền: <strong>{formatVnd(record.amount)}</strong> đồng (Viết bằng số)
          </p>
          <p>(Viết bằng chữ): {amountToVietnameseWordsVnd(record.amount)}</p>
          <p>Kèm theo: {attachmentCount ?? "....."} chứng từ gốc.</p>
        </div>

        <table className="mt-8 w-full text-center text-xs">
          <tbody>
            <tr className="font-bold">
              <td>Thủ trưởng đơn vị</td>
              <td>Kế toán trưởng</td>
              <td>Người lập phiếu</td>
              <td>Thủ quỹ</td>
              <td>Người {isThu ? "nộp" : "nhận"} tiền</td>
            </tr>
            <tr className="italic text-navy/50">
              <td>(Ký, họ tên, đóng dấu)</td>
              <td>(Ký, họ tên)</td>
              <td>(Ký, họ tên)</td>
              <td>(Ký, họ tên)</td>
              <td>(Ký, họ tên)</td>
            </tr>
            <tr style={{ height: "56px" }}>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 text-xs">
          Đã nhận đủ số tiền (viết bằng chữ): {amountToVietnameseWordsVnd(record.amount)}
        </p>
        <p className="mt-2 text-xs text-navy/50">
          + Tỷ giá ngoại tệ (vàng, bạc, đá quý): ..........................
        </p>
        <p className="text-xs text-navy/50">+ Số tiền quy đổi: ..........................</p>
      </div>
    </div>
  );
}
