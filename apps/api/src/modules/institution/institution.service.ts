import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';

function isDuplicate(error: unknown) {
  const row = error as { code?: string; cause?: { code?: string } };
  return row?.code === '23505' || row?.cause?.code === '23505';
}

@Injectable()
export class InstitutionService {
  constructor(private readonly database: DatabaseService) {}

  listYears() {
    return this.database.db.selectFrom('academic_years').selectAll().orderBy('starts_on', 'desc').execute();
  }

  async createYear(input: { name: string; startsOn: string; endsOn: string; isCurrent?: boolean }) {
    if (input.isCurrent) {
      await this.database.db.updateTable('academic_years').set({ is_current: false }).execute();
    }
    return this.database.db
      .insertInto('academic_years')
      .values({
        name: input.name,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        is_current: Boolean(input.isCurrent),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  listGrades() {
    return this.database.db.selectFrom('grades').selectAll().orderBy('level').execute();
  }

  createGrade(input: { level: number; name: string }) {
    return this.database.db.insertInto('grades').values(input).returningAll().executeTakeFirstOrThrow();
  }

  listGroups() {
    return this.database.db
      .selectFrom('groups_class')
      .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
      .innerJoin('academic_years', 'academic_years.id', 'groups_class.academic_year_id')
      .select([
        'groups_class.id',
        'groups_class.name',
        'groups_class.grade_id',
        'groups_class.academic_year_id',
        'grades.level as grade_level',
        'grades.name as grade_name',
        'academic_years.name as year_name',
      ])
      .orderBy('grades.level')
      .orderBy('groups_class.name')
      .execute();
  }

  async createGroup(input: { gradeId: string; academicYearId: string; name: string }) {
    try {
      return await this.database.db
        .insertInto('groups_class')
        .values({ grade_id: input.gradeId, academic_year_id: input.academicYearId, name: input.name.trim() })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (isDuplicate(error)) throw new ApiError(409, 'ALREADY', 'Ese grupo ya existe en ese grado y año');
      throw error;
    }
  }

  listSubjects() {
    return this.database.db.selectFrom('subjects').selectAll().orderBy('name').execute();
  }

  async createSubject(input: { code: string; name: string; area: string }) {
    try {
      return await this.database.db
        .insertInto('subjects')
        .values({ ...input, code: input.code.toUpperCase() })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (isDuplicate(error)) throw new ApiError(409, 'ALREADY', 'Ya existe una materia con ese código');
      throw error;
    }
  }

  async listEnrollments(viewer: { id: string; role: string }, groupId?: string) {
    if (viewer.role === 'teacher') {
      if (!groupId) throw new ApiError(400, 'GROUP_REQUIRED', 'Indica el grupo');
      const teaches = await this.database.db
        .selectFrom('teaching_assignments')
        .select('id')
        .where('teacher_id', '=', viewer.id)
        .where('group_id', '=', groupId)
        .executeTakeFirst();
      if (!teaches) throw new ApiError(403, 'FORBIDDEN', 'No enseñas en ese grupo');
    }
    let query = this.database.db
      .selectFrom('enrollments')
      .innerJoin('users', 'users.id', 'enrollments.user_id')
      .innerJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .select([
        'enrollments.id',
        'enrollments.user_id',
        'enrollments.group_id',
        'enrollments.academic_year_id',
        'enrollments.status',
        'users.full_name',
        'users.email',
        'groups_class.name as group_name',
      ])
      .orderBy('users.full_name');
    if (groupId) query = query.where('enrollments.group_id', '=', groupId);
    return query.execute();
  }

  async createEnrollment(input: { userId: string; groupId: string; academicYearId: string }) {
    const group = await this.database.db
      .selectFrom('groups_class')
      .selectAll()
      .where('id', '=', input.groupId)
      .executeTakeFirst();
    if (!group) throw new ApiError(400, 'GROUP', 'Ese grupo no existe');
    const student = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['users.is_guest', 'user_roles.role'])
      .where('users.id', '=', input.userId)
      .where('user_roles.role', '=', 'student')
      .executeTakeFirst();
    if (!student || student.is_guest) {
      throw new ApiError(400, 'NOT_STUDENT', 'Elige un estudiante del colegio. Los invitados de clase no se matriculan aquí.');
    }
    const existing = await this.database.db
      .selectFrom('enrollments')
      .select(['id', 'group_id'])
      .where('user_id', '=', input.userId)
      .where('academic_year_id', '=', group.academic_year_id)
      .executeTakeFirst();
    if (existing?.group_id === group.id) throw new ApiError(409, 'ALREADY', 'Ese estudiante ya está en ese grupo');
    if (existing) {
      return this.database.db
        .updateTable('enrollments')
        .set({ group_id: group.id, status: 'active' })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    return this.database.db
      .insertInto('enrollments')
      .values({
        user_id: input.userId,
        group_id: group.id,
        academic_year_id: group.academic_year_id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  listTeaching() {
    return this.database.db
      .selectFrom('teaching_assignments')
      .innerJoin('users', 'users.id', 'teaching_assignments.teacher_id')
      .innerJoin('subjects', 'subjects.id', 'teaching_assignments.subject_id')
      .innerJoin('groups_class', 'groups_class.id', 'teaching_assignments.group_id')
      .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
      .innerJoin('academic_years', 'academic_years.id', 'teaching_assignments.academic_year_id')
      .select([
        'teaching_assignments.id',
        'teaching_assignments.teacher_id',
        'teaching_assignments.subject_id',
        'teaching_assignments.group_id',
        'teaching_assignments.academic_year_id',
        'users.full_name as teacher_name',
        'subjects.name as subject_name',
        'groups_class.name as group_name',
        'grades.level as grade_level',
        'grades.name as grade_name',
        'academic_years.name as year_name',
      ])
      .orderBy('grades.level')
      .orderBy('groups_class.name')
      .orderBy('users.full_name')
      .execute();
  }

  async createTeaching(input: { teacherId: string; subjectId: string; groupId?: string; gradeId?: string; academicYearId?: string }) {
    const teacher = await this.database.db
      .selectFrom('user_roles')
      .select('user_id')
      .where('user_id', '=', input.teacherId)
      .where('role', '=', 'teacher')
      .executeTakeFirst();
    if (!teacher) throw new ApiError(400, 'NOT_TEACHER', 'Elige una cuenta con rol docente');
    const subject = await this.database.db.selectFrom('subjects').select('id').where('id', '=', input.subjectId).executeTakeFirst();
    if (!subject) throw new ApiError(400, 'SUBJECT', 'Esa materia no existe');

    let targets: { id: string; academic_year_id: string }[] = [];
    if (input.groupId) {
      const group = await this.database.db
        .selectFrom('groups_class')
        .select(['id', 'academic_year_id'])
        .where('id', '=', input.groupId)
        .executeTakeFirst();
      if (!group) throw new ApiError(400, 'GROUP', 'Ese grupo no existe');
      targets = [group];
    } else if (input.gradeId) {
      const yearId = await this.resolveYear(input.academicYearId);
      targets = await this.database.db
        .selectFrom('groups_class')
        .select(['id', 'academic_year_id'])
        .where('grade_id', '=', input.gradeId)
        .where('academic_year_id', '=', yearId)
        .execute();
      if (!targets.length) throw new ApiError(400, 'NO_GROUPS', 'Ese grado no tiene grupos en el año elegido');
    }

    let created = 0;
    let already = 0;
    for (const group of targets) {
      const existing = await this.database.db
        .selectFrom('teaching_assignments')
        .select('id')
        .where('teacher_id', '=', input.teacherId)
        .where('subject_id', '=', input.subjectId)
        .where('group_id', '=', group.id)
        .where('academic_year_id', '=', group.academic_year_id)
        .executeTakeFirst();
      if (existing) {
        already += 1;
        continue;
      }
      try {
        await this.database.db
          .insertInto('teaching_assignments')
          .values({
            teacher_id: input.teacherId,
            subject_id: input.subjectId,
            group_id: group.id,
            academic_year_id: group.academic_year_id,
          })
          .execute();
        created += 1;
      } catch (error) {
        if (!isDuplicate(error)) throw error;
        already += 1;
      }
    }
    return { created, already };
  }

  async removeTeaching(id: string) {
    const row = await this.database.db.deleteFrom('teaching_assignments').where('id', '=', id).returning('id').executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Esa asignación ya no existe');
    return { ok: true };
  }

  private async resolveYear(preferred?: string) {
    if (preferred) {
      const year = await this.database.db.selectFrom('academic_years').select('id').where('id', '=', preferred).executeTakeFirst();
      if (!year) throw new ApiError(400, 'YEAR', 'Ese año lectivo no existe');
      return year.id;
    }
    const current = await this.database.db.selectFrom('academic_years').select('id').where('is_current', '=', true).executeTakeFirst();
    if (current) return current.id;
    const latest = await this.database.db.selectFrom('academic_years').select('id').orderBy('starts_on', 'desc').executeTakeFirst();
    if (!latest) throw new ApiError(400, 'NO_YEAR', 'Crea primero un año lectivo');
    return latest.id;
  }

  async overview() {
    const [students, teachers, courses, attempts] = await Promise.all([
      this.database.db
        .selectFrom('user_roles')
        .select(sql<number>`count(*)`.as('n'))
        .where('role', '=', 'student')
        .executeTakeFirstOrThrow(),
      this.database.db
        .selectFrom('user_roles')
        .select(sql<number>`count(*)`.as('n'))
        .where('role', '=', 'teacher')
        .executeTakeFirstOrThrow(),
      this.database.db.selectFrom('courses').select(sql<number>`count(*)`.as('n')).executeTakeFirstOrThrow(),
      this.database.db
        .selectFrom('attempts')
        .select(sql<number>`count(*)`.as('n'))
        .where('status', '=', 'completed')
        .executeTakeFirstOrThrow(),
    ]);
    return {
      students: Number(students.n),
      teachers: Number(teachers.n),
      courses: Number(courses.n),
      completedAttempts: Number(attempts.n),
    };
  }
}
