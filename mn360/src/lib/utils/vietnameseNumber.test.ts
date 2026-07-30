import { describe, expect, it } from "vitest";
import { numberToVietnameseWords, amountToVietnameseWordsVnd } from "./vietnameseNumber";

describe("numberToVietnameseWords", () => {
  it("đọc số 0", () => {
    expect(numberToVietnameseWords(0)).toBe("không");
  });

  it("đọc số nghìn tròn", () => {
    expect(numberToVietnameseWords(1000)).toBe("một nghìn");
  });

  it("đọc số có nhóm triệu và nghìn tròn trăm", () => {
    expect(numberToVietnameseWords(1200000)).toBe("một triệu hai trăm nghìn");
  });

  it("đọc mười lăm nghìn (mười + lăm)", () => {
    expect(numberToVietnameseWords(15000)).toBe("mười lăm nghìn");
  });

  it("đọc một trăm linh năm nghìn (linh)", () => {
    expect(numberToVietnameseWords(105000)).toBe("một trăm linh năm nghìn");
  });

  it("đọc hai mươi mốt nghìn (mốt)", () => {
    expect(numberToVietnameseWords(21000)).toBe("hai mươi mốt nghìn");
  });

  it("đọc bốn mươi lăm nghìn", () => {
    expect(numberToVietnameseWords(45000)).toBe("bốn mươi lăm nghìn");
  });

  it("đọc một trăm triệu", () => {
    expect(numberToVietnameseWords(100000000)).toBe("một trăm triệu");
  });

  it("đọc số đầy đủ nhiều nhóm", () => {
    expect(numberToVietnameseWords(1234567)).toBe(
      "một triệu hai trăm ba mươi bốn nghìn năm trăm sáu mươi bảy",
    );
  });

  it("chèn 'không trăm' khi nhóm giữa có hàng chục/đơn vị nhưng không có hàng trăm", () => {
    expect(numberToVietnameseWords(1050000)).toBe("một triệu không trăm năm mươi nghìn");
  });

  it("bỏ qua nhóm giữa toàn số 0", () => {
    expect(numberToVietnameseWords(1000567)).toBe("một triệu năm trăm sáu mươi bảy");
  });
});

describe("amountToVietnameseWordsVnd", () => {
  it("viết hoa chữ cái đầu và thêm 'đồng chẵn.'", () => {
    expect(amountToVietnameseWordsVnd(1200000)).toBe("Một triệu hai trăm nghìn đồng chẵn.");
  });

  it("hoạt động với số 0", () => {
    expect(amountToVietnameseWordsVnd(0)).toBe("Không đồng chẵn.");
  });
});
