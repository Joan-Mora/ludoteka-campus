import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';

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

  createGroup(input: { gradeId: string; academicYearId: string; name: string }) {
    return this.database.db
      .insertInto('groups_class')
      .values({ grade_id: input.gradeId, academic_year_id: input.academicYearId, name: input.name })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  listSubjects() {
    return this.database.db.selectFrom('subjects').selectAll().orderBy('name').execute();
  }

  createSubject(input: { code: string; name: string; area: string }) {
    return this.database.db
      .insertInto('subjects')
      .values({ ...input, code: input.code.toUpperCase() })
      .returningAll()
      .executeTakeFirstOrThrow();
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
    if (!group || group.academic_year_id !== input.academicYearId) {
      throw new ApiError(400, 'GROUP_YEAR', 'El grupo no pertenece a ese año lectivo');
    }
    return this.database.db
      .insertInto('enrollments')
      .values({
        user_id: input.userId,
        group_id: input.groupId,
        academic_year_id: input.academicYearId,
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
      .select([
        'teaching_assignments.id',
        'teaching_assignments.teacher_id',
        'teaching_assignments.subject_id',
        'teaching_assignments.group_id',
        'teaching_assignments.academic_year_id',
        'users.full_name as teacher_name',
        'subjects.name as subject_name',
        'groups_class.name as group_name',
      ])
      .execute();
  }

  createTeaching(input: { teacherId: string; subjectId: string; groupId: string; academicYearId: string }) {
    return this.database.db
      .insertInto('teaching_assignments')
      .values({
        teacher_id: input.teacherId,
        subject_id: input.subjectId,
        group_id: input.groupId,
        academic_year_id: input.academicYearId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
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
