import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { paintHeader, pdfDocument, reportId, workbookBuffer } from '../../core/reports/documents';

@Injectable()
export class AnalyticsService {
  constructor(private readonly database: DatabaseService) {}

  async course(courseId: string) {
    const course = await this.database.db.selectFrom('courses').selectAll().where('id', '=', courseId).executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    const attempts = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(sql<number>`coalesce(avg(case when attempts.max_score > 0 then attempts.score * 100.0 / attempts.max_score end), 0)`.as('avg'))
      .where('assessments.course_id', '=', courseId)
      .where('attempts.status', '=', 'completed')
      .executeTakeFirstOrThrow();
    const lessons = await this.database.db
      .selectFrom('lessons')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .select(sql<number>`count(*)`.as('n'))
      .where('units.course_id', '=', courseId)
      .executeTakeFirstOrThrow();
    const flags = await this.database.db
      .selectFrom('attempt_flags')
      .innerJoin('attempts', 'attempts.id', 'attempt_flags.attempt_id')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(sql<number>`count(*)`.as('n'))
      .where('assessments.course_id', '=', courseId)
      .where('attempt_flags.flagged', '=', true)
      .executeTakeFirstOrThrow();
    return {
      courseId,
      title: course.title,
      average: Math.round(Number(attempts.avg)),
      lessons: Number(lessons.n),
      flaggedAttempts: Number(flags.n),
    };
  }

  async institution() {
    const byGrade = await this.database.db
      .selectFrom('grades')
      .leftJoin('groups_class', 'groups_class.grade_id', 'grades.id')
      .leftJoin('enrollments', 'enrollments.group_id', 'groups_class.id')
      .select(['grades.level', 'grades.name', sql<number>`count(enrollments.id)`.as('students')])
      .groupBy(['grades.level', 'grades.name'])
      .orderBy('grades.level')
      .execute();
    return { byGrade: byGrade.map((row) => ({ ...row, students: Number(row.students) })) };
  }

  async bulletin(userId: string) {
    const user = await this.database.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'El estudiante no existe');
    const attempts = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .innerJoin('courses', 'courses.id', 'assessments.course_id')
      .select(['courses.title as course', 'assessments.title as assessment', 'attempts.score', 'attempts.max_score', 'attempts.status'])
      .where('attempts.user_id', '=', userId)
      .orderBy('attempts.started_at', 'desc')
      .execute();
    const id = reportId('BOL');
    return pdfDocument((doc) => {
      paintHeader(doc, 'Boletín de desempeño', id);
      doc.fontSize(12).text(`Estudiante: ${user.full_name}`);
      doc.text(`Correo: ${user.email}`);
      doc.moveDown();
      if (!attempts.length) doc.text('Todavía no hay evaluaciones registradas en la base de datos.');
      for (const row of attempts) {
        doc.fontSize(11).text(`${row.course} — ${row.assessment}: ${row.score}/${row.max_score} (${row.status})`);
      }
      doc.moveDown();
      doc.fontSize(9).fillColor('#5C6570').text('Datos leídos de attempts, assessments y courses en CockroachDB.');
    });
  }

  async assessmentExcel(assessmentId: string) {
    const assessment = await this.database.db.selectFrom('assessments').selectAll().where('id', '=', assessmentId).executeTakeFirst();
    if (!assessment) throw new ApiError(404, 'NOT_FOUND', 'La evaluación no existe');
    const rows = await this.database.db
      .selectFrom('attempts')
      .innerJoin('users', 'users.id', 'attempts.user_id')
      .select(['users.full_name', 'users.email', 'attempts.score', 'attempts.max_score', 'attempts.status', 'attempts.submitted_at'])
      .where('attempts.assessment_id', '=', assessmentId)
      .orderBy('users.full_name')
      .execute();
    const id = reportId('EVA');
    return workbookBuffer((book) => {
      const sheet = book.addWorksheet('Resultados');
      sheet.addRow(['EduQuest · Colegio Francisco Arango']);
      sheet.addRow([`Resultados: ${assessment.title}`]);
      sheet.addRow([`Generado: ${new Date().toISOString()}`, `Identificador: ${id}`]);
      sheet.addRow([]);
      sheet.addRow(['Estudiante', 'Correo', 'Puntaje', 'Máximo', 'Estado', 'Entrega']);
      for (const row of rows) {
        sheet.addRow([row.full_name, row.email, row.score, row.max_score, row.status, row.submitted_at ? new Date(row.submitted_at).toISOString() : '']);
      }
    });
  }

  async integrityPdf(courseId: string) {
    const course = await this.database.db.selectFrom('courses').selectAll().where('id', '=', courseId).executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    const events = await this.database.db
      .selectFrom('integrity_events')
      .innerJoin('users', 'users.id', 'integrity_events.user_id')
      .innerJoin('attempts', 'attempts.id', 'integrity_events.attempt_id')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(['users.full_name', 'integrity_events.type', 'integrity_events.at', 'assessments.title'])
      .where('assessments.course_id', '=', courseId)
      .orderBy('integrity_events.at', 'desc')
      .limit(80)
      .execute();
    const id = reportId('INT');
    return pdfDocument((doc) => {
      paintHeader(doc, `Integridad · ${course.title}`, id);
      if (!events.length) doc.text('No hay eventos de integridad para este curso.');
      for (const event of events) {
        doc.fontSize(10).text(`${new Date(event.at).toLocaleString('es-CO')} · ${event.full_name} · ${event.title} · ${event.type}`);
      }
    });
  }

  async integrityExcel(courseId: string) {
    const events = await this.database.db
      .selectFrom('integrity_events')
      .innerJoin('users', 'users.id', 'integrity_events.user_id')
      .innerJoin('attempts', 'attempts.id', 'integrity_events.attempt_id')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(['users.full_name', 'users.email', 'integrity_events.type', 'integrity_events.at', 'assessments.title'])
      .where('assessments.course_id', '=', courseId)
      .orderBy('integrity_events.at', 'desc')
      .execute();
    const id = reportId('INT');
    return workbookBuffer((book) => {
      const sheet = book.addWorksheet('Integridad');
      sheet.addRow(['EduQuest · Integridad académica']);
      sheet.addRow([`Generado: ${new Date().toISOString()}`, `Identificador: ${id}`]);
      sheet.addRow([]);
      sheet.addRow(['Estudiante', 'Correo', 'Evaluación', 'Tipo', 'Fecha']);
      for (const event of events) {
        sheet.addRow([event.full_name, event.email, event.title, event.type, new Date(event.at).toISOString()]);
      }
    });
  }

  async rosterExcel() {
    const rows = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['users.full_name', 'users.email', 'user_roles.role', 'users.created_at'])
      .orderBy('users.full_name')
      .execute();
    const id = reportId('USR');
    return workbookBuffer((book) => {
      const sheet = book.addWorksheet('Usuarios');
      sheet.addRow(['EduQuest · Reporte de usuarios']);
      sheet.addRow([`Generado: ${new Date().toISOString()}`, `Identificador: ${id}`]);
      sheet.addRow([]);
      sheet.addRow(['Nombre', 'Correo', 'Rol', 'Creado']);
      for (const row of rows) sheet.addRow([row.full_name, row.email, row.role, new Date(row.created_at).toISOString()]);
    });
  }
}
