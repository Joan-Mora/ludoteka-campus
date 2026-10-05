import type { ColumnType, Generated } from 'kysely';

type Ts = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableDate = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
type NullableString = ColumnType<string | null, string | null | undefined, string | null>;
type NullableInt = ColumnType<number | null, number | null | undefined, number | null>;
type JsonValue = ColumnType<unknown, string | null | undefined, string | null>;

export interface Database {
  users: {
    id: Generated<string>;
    email: string;
    password_hash: string;
    full_name: string;
    is_minor: Generated<boolean>;
    guardian_consent_at: NullableDate;
    created_at: Ts;
    updated_at: Ts;
  };
  user_roles: {
    user_id: string;
    role: string;
    created_at: Ts;
  };
  refresh_tokens: {
    id: Generated<string>;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    revoked_at: NullableDate;
    created_at: Ts;
  };
  password_reset_tokens: {
    id: Generated<string>;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    used_at: NullableDate;
    created_at: Ts;
  };
  audit_log: {
    id: Generated<string>;
    actor_id: NullableString;
    action: string;
    entity: string;
    entity_id: NullableString;
    meta: JsonValue;
    created_at: Ts;
  };
  academic_years: {
    id: Generated<string>;
    name: string;
    starts_on: string;
    ends_on: string;
    is_current: Generated<boolean>;
  };
  periods: {
    id: Generated<string>;
    academic_year_id: string;
    name: string;
    position: number;
    starts_on: string;
    ends_on: string;
  };
  grades: {
    id: Generated<string>;
    level: number;
    name: string;
  };
  groups_class: {
    id: Generated<string>;
    grade_id: string;
    academic_year_id: string;
    name: string;
  };
  subjects: {
    id: Generated<string>;
    code: string;
    name: string;
    area: string;
  };
  enrollments: {
    id: Generated<string>;
    user_id: string;
    group_id: string;
    academic_year_id: string;
    status: Generated<string>;
  };
  teaching_assignments: {
    id: Generated<string>;
    teacher_id: string;
    subject_id: string;
    group_id: string;
    academic_year_id: string;
  };
  courses: {
    id: Generated<string>;
    subject_id: string;
    group_id: string;
    teacher_id: string;
    academic_year_id: string;
    title: string;
    description: Generated<string>;
    published: Generated<boolean>;
    created_at: Ts;
  };
  units: {
    id: Generated<string>;
    course_id: string;
    title: string;
    summary: Generated<string>;
    position: number;
  };
  lessons: {
    id: Generated<string>;
    unit_id: string;
    title: string;
    body_md: Generated<string>;
    estimated_min: Generated<number>;
    position: number;
    published: Generated<boolean>;
  };
  lesson_resources: {
    id: Generated<string>;
    lesson_id: string;
    kind: string;
    title: string;
    url: NullableString;
    position: Generated<number>;
  };
  lesson_progress: {
    user_id: string;
    lesson_id: string;
    status: string;
    completed_at: NullableDate;
  };
  assignments: {
    id: Generated<string>;
    course_id: string;
    lesson_id: NullableString;
    title: string;
    instructions: string;
    due_at: NullableDate;
    max_score: Generated<number>;
  };
  submissions: {
    id: Generated<string>;
    assignment_id: string;
    user_id: string;
    body: string;
    status: Generated<string>;
    score: NullableInt;
    feedback: NullableString;
    submitted_at: Ts;
    graded_at: NullableDate;
  };
  announcements: {
    id: Generated<string>;
    course_id: string;
    author_id: string;
    title: string;
    body: string;
    created_at: Ts;
  };
  calendar_events: {
    id: Generated<string>;
    course_id: string;
    title: string;
    starts_at: Date;
    ends_at: NullableDate;
    kind: Generated<string>;
  };
  competencies: {
    id: Generated<string>;
    subject_id: string;
    grade_id: NullableString;
    code: string;
    name: string;
  };
  questions: {
    id: Generated<string>;
    code: string;
    subject_id: string;
    grade_id: NullableString;
    competency_id: NullableString;
    prompt: string;
    difficulty: Generated<string>;
    explanation: Generated<string>;
    created_by: NullableString;
    active: Generated<boolean>;
    created_at: Ts;
  };
  question_options: {
    id: Generated<string>;
    question_id: string;
    label: string;
    text: string;
    is_correct: Generated<boolean>;
    position: number;
  };
  assessments: {
    id: Generated<string>;
    code: string;
    course_id: string;
    title: string;
    kind: string;
    status: Generated<string>;
    time_limit_sec: Generated<number>;
    created_by: NullableString;
    created_at: Ts;
  };
  assessment_questions: {
    assessment_id: string;
    question_id: string;
    position: number;
    points: Generated<number>;
  };
  attempts: {
    id: Generated<string>;
    assessment_id: string;
    user_id: string;
    status: Generated<string>;
    score: Generated<number>;
    max_score: Generated<number>;
    started_at: Ts;
    submitted_at: NullableDate;
  };
  attempt_answers: {
    id: Generated<string>;
    attempt_id: string;
    question_id: string;
    option_id: NullableString;
    correct: Generated<boolean>;
    points: Generated<number>;
    elapsed_ms: NullableInt;
    answered_at: Ts;
  };
  live_sessions: {
    id: Generated<string>;
    assessment_id: string;
    host_id: string;
    code: string;
    status: Generated<string>;
    current_position: Generated<number>;
    question_started_at: NullableDate;
    created_at: Ts;
  };
  live_participants: {
    session_id: string;
    user_id: string;
    attempt_id: NullableString;
    joined_at: Ts;
  };
  integrity_policies: {
    id: Generated<string>;
    name: string;
    max_violations: Generated<number>;
    is_default: Generated<boolean>;
  };
  integrity_events: {
    id: Generated<string>;
    attempt_id: string;
    user_id: string;
    type: string;
    meta: JsonValue;
    at: Ts;
  };
  attempt_flags: {
    attempt_id: string;
    violation_count: Generated<number>;
    flagged: Generated<boolean>;
    suspended: Generated<boolean>;
  };
  levels: {
    level: number;
    min_xp: number;
    title: string;
  };
  xp_ledger: {
    id: Generated<string>;
    user_id: string;
    amount: number;
    reason: string;
    source_type: string;
    source_id: NullableString;
    created_at: Ts;
  };
  badges: {
    id: Generated<string>;
    code: string;
    name: string;
    description: string;
    icon: Generated<string>;
  };
  user_badges: {
    user_id: string;
    badge_id: string;
    awarded_at: Ts;
  };
  streaks: {
    user_id: string;
    current_count: Generated<number>;
    best_count: Generated<number>;
    last_activity_on: ColumnType<string | null, string | null | undefined, string | null>;
  };
  missions: {
    id: Generated<string>;
    code: string;
    title: string;
    description: string;
    goal_type: string;
    goal_count: number;
    xp_reward: Generated<number>;
    active: Generated<boolean>;
  };
  mission_progress: {
    user_id: string;
    mission_id: string;
    week_key: string;
    progress: Generated<number>;
    completed_at: NullableDate;
  };
  minigame_runs: {
    id: Generated<string>;
    user_id: string;
    game: string;
    score: number;
    xp_awarded: number;
    played_at: Ts;
  };
  leaderboard_snapshots: {
    id: Generated<string>;
    group_id: string;
    week_key: string;
    ranks: JsonValue;
    created_at: Ts;
  };
  tutor_conversations: {
    id: Generated<string>;
    user_id: string;
    course_id: NullableString;
    lesson_id: NullableString;
    created_at: Ts;
  };
  tutor_messages: {
    id: Generated<string>;
    conversation_id: string;
    role: string;
    content: string;
    created_at: Ts;
  };
  recommendations: {
    id: Generated<string>;
    teacher_id: string;
    course_id: string;
    student_id: string;
    body: string;
    created_at: Ts;
  };
  facial_consents: {
    id: Generated<string>;
    user_id: string;
    policy_version: string;
    accepted_at: Ts;
  };
  face_templates: {
    user_id: string;
    model_id: string;
    ciphertext: Buffer;
    iv: Buffer;
    tag: Buffer;
    samples: number;
    spread: number;
    created_at: Ts;
    updated_at: Ts;
  };
  face_attempts: {
    id: Generated<string>;
    user_id: NullableString;
    email_hash: NullableString;
    ip: NullableString;
    mode: string;
    success: boolean;
    reason: string;
    distance: ColumnType<number | null, number | null | undefined, number | null>;
    created_at: Ts;
  };
  report_log: {
    id: Generated<string>;
    seq: number;
    code: string;
    kind: string;
    format: string;
    title: string;
    generated_by: NullableString;
    params: JsonValue;
    row_count: Generated<number>;
    created_at: Ts;
  };
  ai_usage: {
    id: Generated<string>;
    user_id: NullableString;
    feature: string;
    model: string;
    created_at: Ts;
  };
  certificate_templates: {
    id: Generated<string>;
    name: string;
    body_md: string;
    active: Generated<boolean>;
  };
  certificates: {
    id: Generated<string>;
    user_id: string;
    course_id: NullableString;
    code: string;
    title: string;
    issued_at: Ts;
    meta: JsonValue;
  };
  notifications: {
    id: Generated<string>;
    user_id: string;
    title: string;
    body: string;
    read_at: NullableDate;
    created_at: Ts;
  };
  email_outbox: {
    id: Generated<string>;
    to_email: string;
    subject: string;
    body: string;
    status: Generated<string>;
    created_at: Ts;
    sent_at: NullableDate;
  };
}
