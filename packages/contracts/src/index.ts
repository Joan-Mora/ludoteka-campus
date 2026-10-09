import { z } from 'zod';

export const ROLES = ['admin', 'directivo', 'teacher', 'student', 'guardian'] as const;
export type Role = (typeof ROLES)[number];

const strongPassword = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128)
  .regex(/[A-Za-z]/, 'Incluye al menos una letra')
  .regex(/\d/, 'Incluye al menos un número');

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Escribe la contraseña'),
});

export const forgotSchema = z.object({
  email: z.string().email('Correo inválido'),
});

export const resetSchema = z.object({
  token: z.string().min(10),
  password: strongPassword,
});

export const otpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
  trustDevice: z.boolean().optional(),
});

export const otpResendSchema = z.object({
  challengeId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: strongPassword,
});

/** The admin never types a password: the API generates a temporary one and emails it. */
export const passkeyVerifySchema = z.object({
  challengeId: z.string().uuid(),
  response: z
    .object({
      id: z.string().min(1).max(1024),
      rawId: z.string().min(1).max(1024),
      type: z.literal('public-key'),
      response: z.record(z.string(), z.unknown()),
    })
    .passthrough(),
});

export const passkeyRenameSchema = z.object({ label: z.string().min(1).max(60) });

export const legalAcceptSchema = z.object({
  wards: z.array(z.string().uuid()).max(20).optional(),
  guardianPresent: z.boolean().optional(),
});

export const dataRequestSchema = z.object({
  kind: z.literal('delete'),
  reason: z.string().max(500).optional(),
});

export const resolveDataRequestSchema = z.object({ status: z.enum(['done', 'rejected']) });

export const preferencesSchema = z.object({
  companion: z.enum(['luka', 'luna']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email('Correo inválido'),
  fullName: z.string().min(2, 'Escribe el nombre').max(120),
  role: z.enum(ROLES),
  isMinor: z.boolean().optional(),
  groupId: z.string().uuid().optional(),
  guardianOf: z.array(z.string().email()).max(10).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  isMinor: z.boolean().optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export const importRowSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(ROLES),
  group: z.string().max(20).optional(),
  isMinor: z.boolean().optional(),
  guardianOf: z.array(z.string().email()).optional(),
});

export const importCommitSchema = z.object({
  fileName: z.string().min(1).max(200),
  rows: z.array(importRowSchema).min(1).max(2000),
  sendEmails: z.boolean().optional(),
});

export const yearSchema = z.object({
  name: z.string().min(2),
  startsOn: z.string().min(8),
  endsOn: z.string().min(8),
  isCurrent: z.boolean().optional(),
});

export const gradeSchema = z.object({
  level: z.number().int().min(1).max(11),
  name: z.string().min(2),
});

export const groupSchema = z.object({
  gradeId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1).max(20),
});

export const subjectSchema = z.object({
  code: z.string().min(2).max(12),
  name: z.string().min(2),
  area: z.string().min(2),
});

export const enrollmentSchema = z.object({
  userId: z.string().uuid(),
  groupId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

export const teachingSchema = z.object({
  teacherId: z.string().uuid(),
  subjectId: z.string().uuid(),
  groupId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

export const courseSchema = z.object({
  subjectId: z.string().uuid(),
  groupId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
});

export const unitSchema = z.object({
  title: z.string().min(2),
  summary: z.string().optional(),
});

export const lessonSchema = z.object({
  title: z.string().min(2),
  bodyMd: z.string().min(1),
  estimatedMin: z.number().int().min(5).max(120).optional(),
});

export const assignmentSchema = z.object({
  title: z.string().min(2),
  instructions: z.string().min(2),
  dueAt: z.string().optional(),
  maxScore: z.number().int().min(1).max(100).optional(),
  lessonId: z.string().uuid().optional(),
});

export const submissionSchema = z.object({
  body: z.string().min(1).max(8000),
});

export const gradeSchemaSubmission = z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string().max(2000).optional(),
});

export const announcementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
});

export const eventSchema = z.object({
  title: z.string().min(2),
  startsAt: z.string().min(8),
  endsAt: z.string().optional(),
  kind: z.enum(['class', 'exam', 'task', 'event']).optional(),
});

export const questionSchema = z.object({
  subjectId: z.string().uuid(),
  gradeId: z.string().uuid().optional(),
  prompt: z.string().min(4),
  difficulty: z.enum(['baja', 'media', 'alta']).optional(),
  explanation: z.string().optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(2),
        text: z.string().min(1),
        correct: z.boolean(),
      }),
    )
    .min(2)
    .max(6),
});

export const assessmentSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(3),
  kind: z.enum(['practice', 'exam', 'live']),
  timeLimitSec: z.number().int().min(30).max(7200).optional(),
  questionIds: z.array(z.string().uuid()).min(1),
});

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
  elapsedMs: z.number().int().min(0).optional(),
});

export const integritySchema = z.object({
  type: z.enum(['fullscreen_exit', 'visibility_hidden', 'blur', 'escape']),
});

export const liveCreateSchema = z.object({
  assessmentId: z.string().uuid(),
});

export const liveJoinSchema = z.object({
  code: z.string().min(4).max(8),
});

export const minigameSchema = z.object({
  game: z.enum(['carrera', 'fracciones']),
  score: z.number().int().min(0).max(500),
});

export const tutorChatSchema = z.object({
  message: z.string().min(1).max(2000),
  courseId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

export const draftSchema = z.object({
  courseId: z.string().uuid(),
  topic: z.string().min(2).max(200),
  count: z.number().int().min(1).max(5).optional(),
});

export const facialConsentSchema = z.object({
  accepted: z.literal(true),
});

export const FACE_DIM = 128;
export const FACE_MODEL_ID = 'face-api-resnet34-128';
export const LIVENESS_ACTIONS = ['blink', 'turn_left', 'turn_right'] as const;
export type LivenessAction = (typeof LIVENESS_ACTIONS)[number];

const descriptor = z.array(z.number().finite().min(-2).max(2)).length(FACE_DIM, 'El descriptor debe tener 128 valores');

export const facialEnrollSchema = z.object({
  samples: z.array(descriptor).min(3).max(10),
  challengeId: z.string().uuid(),
  modelId: z.literal(FACE_MODEL_ID),
});

export const facialLoginSchema = z.object({
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  descriptor,
  challengeId: z.string().uuid(),
  modelId: z.literal(FACE_MODEL_ID),
});

export const guardianConsentSchema = z.object({
  userId: z.string().uuid(),
});

export const GUARDIAN_RELATIONSHIPS = ['madre', 'padre', 'tutor', 'abuelo', 'otro'] as const;
export const GUARDIAN_SCOPES = ['facial', 'ai_tutor', 'data_processing'] as const;
export type GuardianScope = (typeof GUARDIAN_SCOPES)[number];

export const guardianLinkSchema = z.object({
  guardianEmail: z.string().email(),
  studentEmail: z.string().email(),
  relationship: z.enum(GUARDIAN_RELATIONSHIPS),
});

export const guardianAuthorizationSchema = z.object({
  studentId: z.string().uuid(),
  scope: z.enum(GUARDIAN_SCOPES),
  granted: z.boolean(),
});

export const NEWS_CATEGORIES = ['general', 'academico', 'evento', 'convivencia', 'urgente'] as const;

export const newsAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('role'), value: z.enum(ROLES) }),
  z.object({ kind: z.literal('group'), value: z.string().uuid() }),
  z.object({ kind: z.literal('course'), value: z.string().uuid() }),
]);
export type NewsAudience = z.infer<typeof newsAudienceSchema>;

export const newsSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(1).max(8000),
    category: z.enum(NEWS_CATEGORIES).default('general'),
    pinned: z.boolean().default(false),
    requiresAck: z.boolean().default(false),
    publishAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    audience: z.array(newsAudienceSchema).min(1).max(20),
  })
  .refine((v) => !v.expiresAt || new Date(v.expiresAt) > new Date(v.publishAt ?? Date.now()), {
    message: 'La fecha de vencimiento debe ser posterior a la publicación',
    path: ['expiresAt'],
  });

export const forumThreadSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(6000),
});

export const forumPostSchema = z.object({
  body: z.string().trim().min(1).max(6000),
});

export const LIBRARY_VISIBILITY = ['public', 'institution', 'course'] as const;
const tagList = z.array(z.string().trim().toLowerCase().min(2).max(40)).max(8).default([]);

export const libraryItemSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).default(''),
    subjectId: z.string().uuid(),
    gradeId: z.string().uuid().optional(),
    visibility: z.enum(LIBRARY_VISIBILITY).default('institution'),
    courseId: z.string().uuid().optional(),
    tags: tagList,
    link: z.string().url().max(600).optional(),
    upload: z
      .object({
        publicId: z.string().min(1).max(300),
        version: z.union([z.number(), z.string()]),
        signature: z.string().min(10).max(80),
        secureUrl: z.string().url(),
        resourceType: z.enum(['image', 'video', 'raw']),
        format: z.string().max(20).optional(),
        bytes: z.number().int().min(0).max(52428800),
        etag: z.string().max(80).optional(),
        pages: z.number().int().min(0).optional(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.link) !== Boolean(v.upload), { message: 'Sube un archivo o pega un enlace', path: ['upload'] })
  .refine((v) => v.visibility !== 'course' || Boolean(v.courseId), { message: 'Elige el curso', path: ['courseId'] });

export const libraryUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  visibility: z.enum(LIBRARY_VISIBILITY).optional(),
  courseId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(8).optional(),
  status: z.enum(['published', 'archived']).optional(),
});

export const bookmarkSchema = z.object({
  page: z.number().int().min(1).max(5000).optional(),
  note: z.string().trim().max(500).default(''),
});

export const glossarySchema = z.object({
  subjectId: z.string().uuid(),
  term: z.string().trim().min(2).max(80),
  definition: z.string().trim().min(5).max(1200),
  example: z.string().trim().max(600).default(''),
});

export const libraryAskSchema = z.object({
  question: z.string().trim().min(3).max(600),
  itemId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
});

export const routeGenerateSchema = z.object({
  topicId: z.string().uuid().optional(),
  count: z.number().int().min(1).max(5).optional(),
});

export const routeAnswerSchema = z.object({
  answer: z.string().trim().min(1, 'Escribe tu respuesta').max(60),
});

export const nlQuerySchema = z.object({
  question: z.string().trim().min(5, 'Escribe una pregunta más completa').max(400),
});

export const arenaCreateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(3, 'Escribe un título').max(120).optional(),
  assessmentId: z.string().uuid().optional(),
  count: z.number().int().min(3).max(20).optional(),
  teamSize: z.number().int().min(2).max(5).optional(),
  questionSec: z.number().int().min(15).max(180).optional(),
});

export const arenaJoinSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/, 'El código tiene 6 caracteres'),
});

export const arenaOptionSchema = z.object({
  optionId: z.string().uuid(),
});

export const notebookPageSchema = z.object({
  title: z.string().trim().min(1, 'Ponle un título').max(160),
  body: z.string().max(20000, 'El apunte es muy largo').default(''),
  courseId: z.string().uuid().nullable().optional(),
});

export const flashcardSchema = z.object({
  front: z.string().trim().min(1, 'Escribe la pregunta').max(300),
  back: z.string().trim().min(1, 'Escribe la respuesta').max(600),
  pageId: z.string().uuid().optional(),
});

export const flashcardReviewSchema = z.object({
  grade: z.number().int().min(0).max(5),
});

export const GOAL_KINDS = ['flashcards', 'focus_minutes', 'lessons', 'route'] as const;
export const goalSchema = z.object({
  kind: z.enum(GOAL_KINDS),
  period: z.enum(['daily', 'weekly']),
  target: z.number().int().min(1).max(1000),
});

export const focusStartSchema = z.object({
  plannedMin: z.number().int().min(5).max(120),
  pageId: z.string().uuid().optional(),
});

export const GRADE_SOURCES = ['exam', 'practice', 'live', 'assignment', 'rubric', 'attendance'] as const;
export type GradeSource = (typeof GRADE_SOURCES)[number];
export const gradeCategoriesSchema = z.object({
  categories: z
    .array(z.object({
      name: z.string().trim().min(2).max(60),
      source: z.enum(GRADE_SOURCES),
      weight: z.number().positive().max(100),
    }))
    .min(1, 'Agrega al menos una categoría')
    .max(6),
});

export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'] as const;
export const attendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  entries: z
    .array(z.object({ studentId: z.string().uuid(), status: z.enum(ATTENDANCE_STATUSES), note: z.string().max(200).optional() }))
    .min(1)
    .max(60),
});

export const rubricSchema = z.object({
  title: z.string().trim().min(3, 'Escribe un título').max(120),
  assignmentId: z.string().uuid().optional(),
  criteria: z
    .array(z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(400).optional(), maxPoints: z.number().int().min(1).max(100) }))
    .min(1, 'Agrega al menos un criterio')
    .max(8),
});

export const rubricScoreSchema = z.object({
  studentId: z.string().uuid(),
  scores: z.array(z.object({ criterionId: z.string().uuid(), points: z.number().int().min(0), comment: z.string().max(400).optional() })).min(1).max(8),
});

export const riskAlertUpdateSchema = z.object({
  status: z.enum(['acknowledged', 'resolved']),
});

export const ARENA_ACTIONS = ['rebalance', 'start', 'next', 'pause', 'resume', 'extra'] as const;
export type ArenaAction = (typeof ARENA_ACTIONS)[number];

export const arenaControlSchema = z.object({
  action: z.enum(ARENA_ACTIONS),
});

export interface Citation {
  n: number;
  itemId: string;
  title: string;
  page: number | null;
  excerpt: string;
  url: string;
}

export const certificateIssueSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export type LoginInput = z.infer<typeof loginSchema>;
