import { z } from "zod";

export const documentSchema = z.object({
  docType: z.enum(["incoming", "outgoing", "internal", "draft"]),
  title: z.string().min(3, "Tiêu đề văn bản phải có ít nhất 3 ký tự"),
  summary: z.string().optional(),
  issuingUnit: z.string().optional(),
  recipient: z.string().optional(),
  category: z.string().optional(),
  contentHtml: z.string().optional(),
});
export type DocumentFormInput = z.infer<typeof documentSchema>;
