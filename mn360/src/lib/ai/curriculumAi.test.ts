import { describe, expect, it } from "vitest";
import { parseSections } from "./curriculumAi";

describe("parseSections", () => {
  it("tách đúng từng mục theo nhãn AI trả về", () => {
    const raw =
      "[MỤC TIÊU]\nTrẻ nhận biết các bộ phận cơ thể.\n\n" +
      "[YÊU CẦU CẦN ĐẠT]\nGọi đúng tên 5 bộ phận cơ thể.\n\n" +
      "[NỘI DUNG]\nTìm hiểu về cơ thể bé.\n\n" +
      "[HOẠT ĐỘNG]\nBé khéo tay: xâu vòng.\n\n" +
      "[MÔI TRƯỜNG]\nGóc vận động.\n\n" +
      "[HỌC LIỆU]\nTranh ảnh cơ thể.\n\n" +
      "[PHƯƠNG PHÁP]\nQuan sát, thực hành.";
    const result = parseSections(raw);
    expect(result.objectives).toBe("Trẻ nhận biết các bộ phận cơ thể.");
    expect(result.requirements).toBe("Gọi đúng tên 5 bộ phận cơ thể.");
    expect(result.content).toBe("Tìm hiểu về cơ thể bé.");
    expect(result.activities).toBe("Bé khéo tay: xâu vòng.");
    expect(result.environment).toBe("Góc vận động.");
    expect(result.materials).toBe("Tranh ảnh cơ thể.");
    expect(result.methods).toBe("Quan sát, thực hành.");
  });

  it("không mất nội dung khi AI không theo đúng định dạng nhãn", () => {
    const raw = "Đây là một đoạn văn tự do không có nhãn nào cả, ví dụ AI trả lời sai định dạng.";
    const result = parseSections(raw);
    expect(result.content).toBe(raw);
    expect(result.objectives).toBe("");
  });

  it("chấp nhận thiếu một vài mục, không lỗi", () => {
    const raw = "[MỤC TIÊU]\nChỉ có mục tiêu.";
    const result = parseSections(raw);
    expect(result.objectives).toBe("Chỉ có mục tiêu.");
    expect(result.content).toBe("");
  });
});
