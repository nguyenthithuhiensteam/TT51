import { describe, expect, it } from "vitest";
import {
  ageInDays,
  calcZScore,
  clampToWhoRange,
  classifyBmifa,
  classifyHfa,
  classifyWfa,
  WHO_MAX_AGE_DAYS,
} from "./growth";

describe("ageInDays", () => {
  it("tính đúng số ngày giữa hai mốc ngày", () => {
    expect(ageInDays("2024-01-01", "2024-01-31")).toBe(30);
  });

  it("không cho ra số âm khi ngày đo trước ngày sinh", () => {
    expect(ageInDays("2024-06-01", "2024-01-01")).toBe(0);
  });
});

describe("clampToWhoRange", () => {
  it("giữ nguyên giá trị trong phạm vi [0, 1826]", () => {
    expect(clampToWhoRange(900)).toBe(900);
  });

  it("cắt về 1826 khi vượt quá 60 tháng", () => {
    expect(clampToWhoRange(3000)).toBe(WHO_MAX_AGE_DAYS);
  });

  it("cắt về 0 khi âm", () => {
    expect(clampToWhoRange(-5)).toBe(0);
  });
});

describe("calcZScore (công thức LMS/Cole)", () => {
  it("trả về 0 khi giá trị đo đúng bằng trung vị M", () => {
    expect(calcZScore(0.3487, 3.3464, 0.14602, 3.3464)).toBeCloseTo(0, 6);
  });

  it("dùng công thức log khi L≈0 (vd chiều cao/tuổi có L=1, không rơi vào nhánh này — kiểm tra nhánh log riêng)", () => {
    // L=0 → z = ln(X/M)/S
    expect(calcZScore(0, 10, 0.1, 11)).toBeCloseTo(Math.log(11 / 10) / 0.1, 6);
  });

  it("khớp với bảng WHO thực tế: cân nặng/tuổi bé trai 0 ngày tuổi, nặng 3.3464kg (đúng M) → z=0", () => {
    // L=0.3487, M=3.3464, S=0.14602 (weianthro.txt, sex=1, age=0)
    expect(calcZScore(0.3487, 3.3464, 0.14602, 3.3464)).toBeCloseTo(0, 6);
  });
});

describe("classifyWfa (cân nặng/tuổi)", () => {
  it("z < -3 là suy dinh dưỡng nhẹ cân mức độ nặng", () => {
    expect(classifyWfa(-3.5).code).toBe("sdd_nhe_can_nang");
  });
  it("-3 <= z < -2 là suy dinh dưỡng nhẹ cân", () => {
    expect(classifyWfa(-2.5).code).toBe("sdd_nhe_can");
  });
  it("z >= -2 là bình thường", () => {
    expect(classifyWfa(0).code).toBe("binh_thuong");
  });
});

describe("classifyHfa (chiều cao/tuổi)", () => {
  it("z < -3 là thấp còi mức độ nặng", () => {
    expect(classifyHfa(-3.1).code).toBe("thap_coi_nang");
  });
  it("-3 <= z < -2 là thấp còi", () => {
    expect(classifyHfa(-2.1).code).toBe("thap_coi");
  });
});

describe("classifyBmifa (BMI/tuổi)", () => {
  it("z <= 1 là bình thường", () => {
    expect(classifyBmifa(1).code).toBe("binh_thuong");
  });
  it("1 < z <= 2 là có nguy cơ thừa cân", () => {
    expect(classifyBmifa(1.5).code).toBe("nguy_co_thua_can");
  });
  it("2 < z <= 3 là thừa cân", () => {
    expect(classifyBmifa(2.5).code).toBe("thua_can");
  });
  it("z > 3 là béo phì", () => {
    expect(classifyBmifa(3.5).code).toBe("beo_phi");
  });
});
