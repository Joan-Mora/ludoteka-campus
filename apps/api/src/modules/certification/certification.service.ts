import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { DatabaseService } from '../../core/database/database.service';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { shortCode } from '../../core/common/crypto';
import { paintHeader, pdfDocument, reportId } from '../../core/reports/documents';
import { AssessmentService } from '../assessment/public-api';

@Injectable()
export class CertificationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly env: Env,
    private readonly assessment: AssessmentService,
  ) {}

  async issue(teacherId: string, input: { userId: string; courseId: string }) {
    const course = await this.database.db.selectFrom('courses').selectAll().where('id', '=', input.courseId).executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    const passed = await this.assessment.hasPassingExam(input.userId, input.courseId);
    if (!passed) throw new ApiError(409, 'NOT_READY', 'Hace falta un examen del curso con al menos 60%');
    const existing = await this.database.db
      .selectFrom('certificates')
      .selectAll()
      .where('user_id', '=', input.userId)
      .where('course_id', '=', input.courseId)
      .executeTakeFirst();
    if (existing) return existing;
    const code = `EQ-${shortCode(8)}`;
    return this.database.db
      .insertInto('certificates')
      .values({
        user_id: input.userId,
        course_id: input.courseId,
        code,
        title: `Competencias lógicas · ${course.title}`,
        meta: JSON.stringify({ issuedBy: teacherId, school: 'Colegio Francisco Arango' }),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  mine(userId: string) {
    return this.database.db
      .selectFrom('certificates')
      .leftJoin('courses', 'courses.id', 'certificates.course_id')
      .select(['certificates.id', 'certificates.code', 'certificates.title', 'certificates.issued_at', 'courses.title as course_title'])
      .where('certificates.user_id', '=', userId)
      .orderBy('certificates.issued_at', 'desc')
      .execute();
  }

  async publicByCode(code: string) {
    const row = await this.database.db
      .selectFrom('certificates')
      .innerJoin('users', 'users.id', 'certificates.user_id')
      .leftJoin('courses', 'courses.id', 'certificates.course_id')
      .select(['certificates.code', 'certificates.title', 'certificates.issued_at', 'users.full_name', 'courses.title as course_title'])
      .where('certificates.code', '=', code.toUpperCase())
      .executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'No hay un certificado con ese código');
    return {
      code: row.code,
      title: row.title,
      student: row.full_name,
      course: row.course_title,
      issuedAt: row.issued_at,
      school: 'Colegio Francisco Arango',
    };
  }

  async pdf(code: string) {
    const data = await this.publicByCode(code);
    const url = `${this.env.values.APP_PUBLIC_URL.replace(/\/$/, '')}/verificar/${data.code}`;
    const qr = await QRCode.toBuffer(url, { width: 180, margin: 1 });
    const id = reportId('CER');
    return pdfDocument((doc) => {
      paintHeader(doc, 'Certificado de competencias lógicas', id);
      doc.fontSize(12).text('El Colegio Francisco Arango reconoce a');
      doc.moveDown(0.4);
      doc.fontSize(18).fillColor('#243E73').text(data.student);
      doc.fillColor('#1C2430').fontSize(12).text(data.title);
      if (data.course) doc.text(`Curso: ${data.course}`);
      doc.text(`Emitido: ${new Date(data.issuedAt).toLocaleDateString('es-CO')}`);
      doc.text(`Código: ${data.code}`);
      doc.moveDown();
      doc.image(qr, { width: 120 });
      doc.moveDown();
      doc.fontSize(9).fillColor('#5C6570').text(`Verificación pública: ${url}`);
      doc.text('Aval institucional: firma del rector en calidad de plantilla, pendiente de formalización.');
    });
  }
}
