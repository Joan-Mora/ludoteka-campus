export const DomainEvents = {
  LessonCompleted: 'lesson.completed',
  SubmissionGraded: 'submission.graded',
  AttemptGraded: 'attempt.graded',
  IntegrityViolation: 'integrity.violation',
  IntegritySuspend: 'integrity.suspend',
  PasswordReset: 'password.reset',
  TutorMessage: 'tutor.message',
  NewsPublished: 'news.published',
  ForumReply: 'forum.reply',
  GuardianFacialRevoked: 'guardian.facial_revoked',
  RouteSolved: 'route.solved',
  ArenaFinished: 'arena.finished',
  StudyProgress: 'study.progress',
  RiskAlertRaised: 'risk.alert_raised',
} as const;

export interface StudyProgressEvent {
  userId: string;
  kind: 'review' | 'focus';
  refId: string;
  /** Tarjetas repasadas o minutos de enfoque. */
  amount: number;
}

export interface RiskAlertRaisedEvent {
  alertId: string;
  courseId: string;
  courseTitle: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  kind: string;
  level: string;
  detail: string;
}

export interface ArenaFinishedEvent {
  roomId: string;
  players: { userId: string; rank: number; correct: number }[];
}

export interface RouteSolvedEvent {
  userId: string;
  itemId: string;
  level: number;
  levelUp: boolean;
}

export interface NewsPublishedEvent {
  newsId: string;
  title: string;
  category: string;
  requiresAck: boolean;
  recipientIds: string[];
}

export interface ForumReplyEvent {
  userId: string;
  threadId: string;
  title: string;
  authorName: string;
}

export interface GuardianFacialRevokedEvent {
  studentId: string;
  guardianId: string;
}

export interface LessonCompletedEvent {
  userId: string;
  lessonId: string;
  courseId: string;
}

export interface SubmissionGradedEvent {
  userId: string;
  submissionId: string;
  score: number;
}

export interface AttemptGradedEvent {
  userId: string;
  attemptId: string;
  courseId: string;
  score: number;
  maxScore: number;
}

export interface IntegrityViolationEvent {
  userId: string;
  attemptId: string;
  courseId: string;
  teacherId: string;
  type: string;
  count: number;
  suspended: boolean;
}

export interface IntegritySuspendEvent {
  attemptId: string;
}

export interface PasswordResetEvent {
  email: string;
  fullName: string;
  link: string;
}

export interface TutorMessageEvent {
  userId: string;
}
