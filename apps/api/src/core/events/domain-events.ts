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
  ForumMention: 'forum.mention',
  ForumBestAnswer: 'forum.best_answer',
  GuardianFacialRevoked: 'guardian.facial_revoked',
  RouteSolved: 'route.solved',
  ArenaFinished: 'arena.finished',
  StudyProgress: 'study.progress',
  RiskAlertRaised: 'risk.alert_raised',
  MeetingScheduled: 'meeting.scheduled',
  MeetingResponded: 'meeting.responded',
  GuardianMessage: 'guardian.message',
  StaffMessage: 'staff.message',
  SignatureDecided: 'signature.decided',
  SignatureRequested: 'signature.requested',
  LearningProfileSaved: 'profile.saved',
  ArcadeFinished: 'arcade.finished',
  BadgeEarned: 'badge.earned',
  BadgesSeen: 'badges.seen',
  NewsRead: 'news.read',
} as const;

/** Una evaluación puede subir varias insignias a la vez; llegan juntas para avisar una sola vez. */
export interface BadgeEarnedEvent {
  userId: string;
  badges: { code: string; name: string; tier: number; maxTier: number }[];
}

export interface BadgesSeenEvent {
  userId: string;
}

export interface NewsReadEvent {
  userId: string;
  newsId: string;
}

export interface ArcadeFinishedEvent {
  userId: string;
  sessionId: string;
  game: string;
  score: number;
  correct: number;
  total: number;
  xp: number;
  daily: boolean;
  perfect: boolean;
}

export interface LearningProfileSavedEvent {
  userId: string;
  method: string;
  retake: boolean;
}

export interface MeetingScheduledEvent {
  meetingId: string;
  guardianId: string;
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  scheduledAt: Date;
  mode: string;
  place: string;
  reason: string;
  organizer: string;
}

export interface MeetingRespondedEvent {
  meetingId: string;
  organizerId: string;
  guardianName: string;
  studentName: string;
  attending: boolean;
  note: string | null;
}

export interface GuardianMessageEvent {
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'guardian' | 'teacher';
  authorName: string;
  studentId: string;
  studentName: string;
  body: string;
}

export interface StaffMessageEvent {
  recipientId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
}

export interface SignatureRequestedEvent {
  kind: 'certificate' | 'bulletin';
  title: string;
  studentName: string;
}

export interface SignatureDecidedEvent {
  kind: 'certificate' | 'bulletin';
  requesterId: string | null;
  studentId: string;
  title: string;
  studentName: string;
  approved: boolean;
  note: string | null;
}

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

export interface ForumMentionEvent {
  userIds: string[];
  threadId: string;
  title: string;
  authorName: string;
}

/** Fires once per reply the first time it is chosen as the best answer by someone other than its author. */
export interface ForumBestAnswerEvent {
  userId: string;
  postId: string;
  threadId: string;
  title: string;
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
