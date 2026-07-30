import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Input";
import { generateWithAi } from "../../lib/ai/gateway";

const SYSTEM_PROMPT =
  "Bạn là trợ lý AI chung cho cán bộ, giáo viên trường mầm non đang dùng phần mềm MN360. " +
  "Hỗ trợ soạn thảo, tra cứu kiến thức nghiệp vụ, gợi ý cách xử lý công việc. " +
  "Trả lời ngắn gọn, rõ ràng, bằng tiếng Việt. Không bịa đặt số liệu, quy định hay văn bản pháp luật cụ thể nếu không chắc chắn.";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function FloatingAiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const result = await generateWithAi(SYSTEM_PROMPT, question);
      setMessages((prev) => [...prev, { role: "assistant", content: result.content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể hỏi Trợ lý AI lúc này");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-navy/10 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles size={16} /> Trợ lý AI
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng trợ lý AI"
              className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <p className="border-b border-navy/5 bg-cream px-3 py-1.5 text-[11px] text-navy/50">
            Không nhập tên, ngày sinh, thông tin sức khỏe của trẻ/phụ huynh vào đây.
          </p>
          <div className="flex max-h-80 min-h-[8rem] flex-col gap-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="text-sm text-navy/40">Hỏi bất cứ điều gì cần hỗ trợ trong công việc hằng ngày.</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm ${
                  m.role === "user" ? "self-end bg-brand/10 text-navy" : "self-start bg-cream text-navy"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {loading && <p className="self-start text-sm text-navy/40">Đang trả lời...</p>}
          </div>
          {error && <p className="border-t border-navy/5 px-3 py-1.5 text-xs text-danger">{error}</p>}
          <div className="flex gap-2 border-t border-navy/10 p-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nhập câu hỏi..."
              className="min-h-[40px] flex-1 py-2 text-sm"
            />
            <Button size="sm" disabled={!input.trim() || loading} onClick={handleSend}>
              Gửi
            </Button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Mở trợ lý AI"
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-card transition-colors hover:bg-brand-dark"
      >
        <Sparkles size={20} />
      </button>
    </>
  );
}
