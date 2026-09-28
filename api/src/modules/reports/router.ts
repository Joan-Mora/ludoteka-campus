import { Router } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { randomBytes } from "crypto";
import { query } from "../../shared/db/pool";
import { AppError } from "../../shared/errors";
import { requireAuth, requireRoles, type AuthedRequest } from "../../shared/middleware/auth";
import { config } from "../../shared/config";

export const reportsRouter = Router();

async function assertSessionTeacher(sessionId: string, userId: string, role: string) {
  const session = await query<{ id: string; code: string; title: string | null; teacher_id: string }>(
    `SELECT id, code, title, teacher_id FROM quiz_sessions WHERE id = $1`,
    [sessionId],
  );
  if (!session.rowCount) throw new AppError(404, "NOT_FOUND", "Sesión no encontrada.");
  if (session.rows[0].teacher_id !== userId && role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "No puedes exportar esta sesión.");
  }
  return session.rows[0];
}

reportsRouter.get("/attempts/:id/certificate.pdf", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const row = await query<{
      attempt_id: string;
      user_id: string;
      teacher_id: string;
      name: string;
      email: string;
      score: number;
      status: string;
      title: string | null;
      code: string | null;
    }>(
      `SELECT a.id AS attempt_id, a.user_id, s.teacher_id, u.name, u.email, a.score, a.status, s.title,
              c.code
       FROM quiz_attempts a
       JOIN quiz_sessions s ON s.id = a.session_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN certificates c ON c.attempt_id = a.id
       WHERE a.id = $1`,
      [req.params.id],
    );
    if (!row.rowCount) throw new AppError(404, "NOT_FOUND", "Intento no encontrado.");
    const data = row.rows[0];
    const allowed =
      data.user_id === req.user!.id ||
      data.teacher_id === req.user!.id ||
      req.user!.role === "admin";
    if (!allowed) throw new AppError(403, "FORBIDDEN", "No puedes descargar este certificado.");

    // EQ-C06: solo intentos completados (no suspendidos / no activos).
    if (data.status !== "completed") {
      throw new AppError(404, "NOT_FOUND", "Certificado no disponible para este intento.");
    }

    let certCode = data.code;
    if (!certCode) {
      certCode = `EQ-${randomBytes(4).toString("hex").toUpperCase()}`;
      await query(
        `INSERT INTO certificates (attempt_id, code, pdf_meta) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (attempt_id) DO NOTHING`,
        [data.attempt_id, certCode, JSON.stringify({ score: data.score })],
      );
      const again = await query<{ code: string }>(
        `SELECT code FROM certificates WHERE attempt_id = $1`,
        [data.attempt_id],
      );
      certCode = again.rows[0]?.code ?? certCode;
    }

    const verifyUrl = `${config.appPublicUrl}/verify/${certCode}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificado-${certCode}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    doc.fontSize(20).fillColor("#1B4F72").text("EduQuest", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor("#333").text("Colegio Francisco Arango", { align: "center" });
    doc.moveDown(1.5);
    doc.fontSize(16).text("Certificado de participación", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text(`Estudiante: ${data.name}`);
    doc.text(`Correo: ${data.email}`);
    doc.text(`Sesión: ${data.title ?? "Evaluación"}`);
    doc.text(`Puntaje: ${data.score}`);
    doc.text(`Estado: ${data.status}`);
    doc.text(`ID certificado: ${certCode}`);
    doc.moveDown(1);
    doc.text(`Verificación: ${verifyUrl}`);
    doc.moveDown(2);
    doc.fontSize(10).fillColor("#666").text("Aval rectoría: __________________ (placeholder)", { align: "center" });
    doc.text(`Emitido: ${new Date().toISOString()}`, { align: "center" });
    doc.end();
  } catch (err) {
    next(err);
  }
});

reportsRouter.get(
  "/sessions/:id/report.xlsx",
  requireAuth,
  requireRoles("teacher", "admin"),
  async (req: AuthedRequest, res, next) => {
    try {
      const session = await assertSessionTeacher(String(req.params.id), req.user!.id, req.user!.role);

      const ranking = await query(
        `SELECT u.name, u.email, a.score, a.status,
                (SELECT COUNT(*)::int FROM integrity_events ie WHERE ie.attempt_id = a.id) AS integrity_count,
                COALESCE(
                  (SELECT MAX(aa.answered_at) FROM attempt_answers aa WHERE aa.attempt_id = a.id),
                  a.joined_at
                ) AS submitted_at
         FROM quiz_attempts a
         JOIN users u ON u.id = a.user_id
         WHERE a.session_id = $1
         ORDER BY a.score DESC`,
        [req.params.id],
      );

      const wb = new ExcelJS.Workbook();
      wb.creator = "EduQuest";
      const sheet = wb.addWorksheet("Resultados");
      sheet.addRow(["EduQuest — Reporte de sesión", new Date().toISOString()]);
      sheet.addRow(["Código", session.code, "Título", session.title ?? ""]);
      sheet.addRow([]);
      sheet.addRow(["Estudiante", "Correo", "Score", "Status", "Integrity count", "Submitted at"]);
      for (const r of ranking.rows as Array<{
        name: string;
        email: string;
        score: number;
        status: string;
        integrity_count: number;
        submitted_at: Date | string | null;
      }>) {
        const submitted =
          r.submitted_at instanceof Date
            ? r.submitted_at.toISOString()
            : r.submitted_at
              ? String(r.submitted_at)
              : "";
        sheet.addRow([r.name, r.email, r.score, r.status, r.integrity_count, submitted]);
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="sesion-${session.code}.xlsx"`);
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/sessions/:id/report.pdf",
  requireAuth,
  requireRoles("teacher", "admin"),
  async (req: AuthedRequest, res, next) => {
    try {
      const session = await assertSessionTeacher(String(req.params.id), req.user!.id, req.user!.role);

      const ranking = await query(
        `SELECT u.name, a.score, a.status,
                (SELECT COUNT(*)::int FROM integrity_events ie WHERE ie.attempt_id = a.id) AS integrity_count
         FROM quiz_attempts a
         JOIN users u ON u.id = a.user_id
         WHERE a.session_id = $1
         ORDER BY a.score DESC`,
        [req.params.id],
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="sesion-${session.code}.pdf"`);

      const doc = new PDFDocument({ margin: 48 });
      doc.pipe(res);
      doc.fontSize(18).fillColor("#1B4F72").text("EduQuest — Reporte de sesión", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#333").text(`Código: ${session.code}`);
      doc.text(`Título: ${session.title ?? "Evaluación"}`);
      doc.text(`Generado: ${new Date().toISOString()}`);
      doc.moveDown(1);
      doc.fontSize(12).text("Resumen de intentos");
      doc.moveDown(0.5);

      for (const r of ranking.rows as Array<{
        name: string;
        score: number;
        status: string;
        integrity_count: number;
      }>) {
        doc
          .fontSize(10)
          .text(
            `• ${r.name} — score ${r.score} — ${r.status} — integridad ${r.integrity_count}`,
          );
      }

      if (!ranking.rowCount) {
        doc.fontSize(10).fillColor("#666").text("Sin intentos registrados.");
      }

      doc.end();
    } catch (err) {
      next(err);
    }
  },
);

