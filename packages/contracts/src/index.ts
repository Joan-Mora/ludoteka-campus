import { z } from 'zod';

export const ROLES = ['admin', 'directivo', 'teacher', 'student', 'guardian'] as const;
export type Role = (typeof ROLES)[number];

export const registerSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  fullName: z.string().min(2, 'Escribe tu nombre').max(120),
});

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Escribe la contraseña'),
});

export const forgotSchema = z.object({
  email: z.string().email('Correo inválido'),
});

export const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(120),
  role: z.enum(ROLES),
  isMinor: z.boolean().optional(),
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

export const certificateIssueSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
