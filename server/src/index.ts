import express from "express";
import cors from "cors";
import "./db.js";
import { ensureSeedUsers } from "./services/authService.js";
import { ensureSeedObjectives } from "./seed/seedObjectives.js";
import { authRouter } from "./routes/auth.js";
import { objectivesRouter } from "./routes/objectives.js";
import { aiRouter } from "./routes/ai.js";
import { annualPlansRouter } from "./routes/annualPlans.js";
import { themePlansRouter } from "./routes/themePlans.js";
import { weeklyPlansRouter } from "./routes/weeklyPlans.js";
import { lessonPlansRouter } from "./routes/lessonPlans.js";

ensureSeedUsers();
ensureSeedObjectives();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/objectives", objectivesRouter);
app.use("/api/ai", aiRouter);
app.use("/api/annual-plans", annualPlansRouter);
app.use("/api/theme-plans", themePlansRouter);
app.use("/api/weekly-plans", weeklyPlansRouter);
app.use("/api/lesson-plans", lessonPlansRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Đã xảy ra lỗi hệ thống không mong muốn. Vui lòng thử lại sau." });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`Máy chủ API đang chạy tại http://localhost:${port}`);
});
