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
    status: Generated<string>;
    must_change_password: Generated<boolean>;
    last_login_at: NullableDate;
    failed_logins: Generated<number>;
    locked_until: NullableDate;
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
    family_id: NullableString;
    auth_method: NullableString;
    user_agent: NullableString;
    ip: NullableString;
    replaced_at: NullableDate;
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
    is_demo: Generated<boolean>;
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
    category: Generated<string>;
    thresholds: JsonValue;
    hidden: Generated<boolean>;
    seasonal: Generated<boolean>;
    position: Generated<number>;
    active: Generated<boolean>;
  };
  user_badges: {
    user_id: string;
    badge_id: string;
    awarded_at: Ts;
  };
  user_achievements: {
    user_id: string;
    badge_id: string;
    season: Generated<string>;
    tier: number;
    progress: Generated<number>;
    awarded_at: Ts;
    upgraded_at: Ts;
    seen_at: NullableDate;
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
    session_id: NullableString;
    daily: Generated<boolean>;
  };
  arcade_games: {
    code: string;
    title: string;
    generator: NullableString;
    rounds: number;
    seconds: number;
    position: number;
    active: Generated<boolean>;
  };
  arcade_sessions: {
    id: Generated<string>;
    user_id: string;
    game: string;
    topic_id: NullableString;
    level: number;
    daily_on: ColumnType<string | null, string | null | undefined, string | null>;
    items: JsonValue;
    state: JsonValue;
    total: number;
    correct: NullableInt;
    score: NullableInt;
    xp_awarded: NullableInt;
    started_at: Ts;
    finished_at: NullableDate;
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
    citations: JsonValue;
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
    status: Generated<string>;
    requested_by: NullableString;
    signed_by: NullableString;
    signed_at: NullableDate;
    decision_note: NullableString;
  };
  notifications: {
    id: Generated<string>;
    user_id: string;
    title: string;
    body: string;
    read_at: NullableDate;
    created_at: Ts;
    kind: Generated<string>;
    link: NullableString;
    building: NullableString;
    entity_id: NullableString;
  };
  library_visits: {
    user_id: string;
    visited_at: Ts;
  };
  library_items: {
    id: Generated<string>;
    title: string;
    description: Generated<string>;
    subject_id: string;
    grade_id: NullableString;
    kind: string;
    url: string;
    cloudinary_public_id: NullableString;
    resource_type: NullableString;
    format: NullableString;
    bytes: Generated<number>;
    pages: NullableInt;
    checksum: NullableString;
    visibility: Generated<string>;
    course_id: NullableString;
    status: Generated<string>;
    text_chars: Generated<number>;
    uploaded_by: NullableString;
    created_at: Ts;
    updated_at: Ts;
    source_name: NullableString;
    source_url: NullableString;
    license: NullableString;
  };
  library_tags: {
    item_id: string;
    tag: string;
  };
  bookmarks: {
    user_id: string;
    item_id: string;
    page: NullableInt;
    note: Generated<string>;
    created_at: Ts;
  };
  library_views: {
    id: Generated<string>;
    item_id: string;
    user_id: NullableString;
    viewed_at: Ts;
  };
  glossary_terms: {
    id: Generated<string>;
    subject_id: string;
    term: string;
    definition: string;
    example: Generated<string>;
    source_item_id: NullableString;
    created_by: NullableString;
    created_at: Ts;
  };
  library_chunks: {
    id: Generated<string>;
    item_id: string;
    ordinal: number;
    page: NullableInt;
    content: string;
    tsv: Generated<string>;
    embedding: NullableString;
  };
  topics: {
    id: Generated<string>;
    subject_id: string;
    grade_id: NullableString;
    code: string;
    name: string;
    generator: string;
    position: number;
  };
  question_topics: {
    question_id: string;
    topic_id: string;
  };
  topic_mastery: {
    user_id: string;
    topic_id: string;
    level: Generated<number>;
    streak: Generated<number>;
    correct_count: Generated<number>;
    attempt_count: Generated<number>;
    updated_at: Ts;
  };
  route_items: {
    id: Generated<string>;
    user_id: string;
    topic_id: string;
    level: number;
    generator: string;
    params: JsonValue;
    prompt: string;
    hint: Generated<string>;
    answer: string;
    answer_kind: string;
    explanation: Generated<string>;
    source: string;
    ai_answer: NullableString;
    verification: string;
    status: Generated<string>;
    given: NullableString;
    created_at: Ts;
    answered_at: NullableDate;
    method: NullableString;
    level_change: NullableInt;
    boss: Generated<boolean>;
  };
  learning_profiles: {
    id: Generated<string>;
    user_id: string;
    period_id: NullableString;
    version: Generated<number>;
    answers: JsonValue;
    scores: JsonValue;
    primary_method: string;
    secondary_method: NullableString;
    taken_at: Ts;
  };
  learning_activity: {
    id: Generated<string>;
    user_id: string;
    method: string;
    topic_id: NullableString;
    resource: Generated<string>;
    created_at: Ts;
  };
  nl_queries: {
    id: Generated<string>;
    user_id: string;
    question: string;
    sql_text: NullableString;
    status: string;
    reason: NullableString;
    row_count: Generated<number>;
    duration_ms: NullableInt;
    created_at: Ts;
  };
  notebook_pages: {
    id: Generated<string>;
    user_id: string;
    course_id: NullableString;
    title: string;
    body: Generated<string>;
    summary: NullableString;
    key_points: JsonValue;
    summary_source: NullableString;
    summarized_at: NullableDate;
    created_at: Ts;
    updated_at: Ts;
  };
  flashcards: {
    id: Generated<string>;
    user_id: string;
    page_id: NullableString;
    front: string;
    back: string;
    source: Generated<string>;
    ease: ColumnType<string, string | number | undefined, string | number>;
    interval_days: Generated<number>;
    repetitions: Generated<number>;
    due_at: Ts;
    last_reviewed_at: NullableDate;
    created_at: Ts;
  };
  flashcard_reviews: {
    id: Generated<string>;
    card_id: string;
    user_id: string;
    grade: number;
    interval_days: number;
    ease: ColumnType<string, string | number, string | number>;
    reviewed_at: Ts;
  };
  goals: {
    id: Generated<string>;
    user_id: string;
    kind: string;
    period: string;
    target: number;
    active: Generated<boolean>;
    created_at: Ts;
  };
  focus_sessions: {
    id: Generated<string>;
    user_id: string;
    page_id: NullableString;
    planned_min: number;
    status: Generated<string>;
    actual_sec: NullableInt;
    started_at: Ts;
    ended_at: NullableDate;
  };
  grade_categories: {
    id: Generated<string>;
    course_id: string;
    name: string;
    source: string;
    weight: ColumnType<string, string | number, string | number>;
    position: number;
  };
  rubrics: {
    id: Generated<string>;
    course_id: string;
    assignment_id: NullableString;
    title: string;
    created_by: NullableString;
    created_at: Ts;
  };
  rubric_criteria: {
    id: Generated<string>;
    rubric_id: string;
    name: string;
    description: Generated<string>;
    max_points: number;
    position: number;
  };
  rubric_scores: {
    criterion_id: string;
    student_id: string;
    rubric_id: string;
    points: number;
    comment: Generated<string>;
    graded_by: NullableString;
    graded_at: Ts;
  };
  attendance: {
    id: Generated<string>;
    course_id: string;
    student_id: string;
    session_on: ColumnType<string, string, string>;
    status: string;
    note: Generated<string>;
    recorded_by: NullableString;
    recorded_at: Ts;
  };
  risk_alerts: {
    id: Generated<string>;
    student_id: string;
    course_id: string;
    kind: string;
    level: string;
    detail: string;
    status: Generated<string>;
    created_at: Ts;
    resolved_at: NullableDate;
    resolved_by: NullableString;
  };
  arena_rooms: {
    id: Generated<string>;
    code: string;
    host_id: string;
    course_id: string;
    title: string;
    question_ids: string[];
    team_size: Generated<number>;
    question_sec: Generated<number>;
    status: Generated<string>;
    current_index: Generated<number>;
    snapshot: JsonValue;
    snapshot_at: NullableDate;
    created_at: Ts;
    started_at: NullableDate;
    ended_at: NullableDate;
  };
  arena_teams: {
    id: Generated<string>;
    room_id: string;
    name: string;
    color: string;
    position: number;
    score: Generated<number>;
  };
  arena_members: {
    room_id: string;
    user_id: string;
    team_id: string;
    joined_at: Ts;
  };
  arena_answers: {
    id: Generated<string>;
    room_id: string;
    team_id: string;
    question_index: number;
    question_id: string;
    option_id: NullableString;
    locked_by: NullableString;
    votes: JsonValue;
    elapsed_ms: number;
    correct: Generated<boolean>;
    points: Generated<number>;
    reveal_order: number;
    locked_at: Ts;
  };
  arena_results: {
    room_id: string;
    team_id: string;
    rank: number;
    score: number;
    correct_count: number;
  };
  guardian_links: {
    id: Generated<string>;
    guardian_id: string;
    student_id: string;
    relationship: string;
    status: Generated<string>;
    created_by: NullableString;
    created_at: Ts;
  };
  guardian_authorizations: {
    id: Generated<string>;
    link_id: string;
    scope: string;
    policy_version: string;
    granted: boolean;
    ip: NullableString;
    created_at: Ts;
  };
  news: {
    id: Generated<string>;
    author_id: string;
    title: string;
    body: string;
    category: Generated<string>;
    pinned: Generated<boolean>;
    requires_ack: Generated<boolean>;
    official: Generated<boolean>;
    publish_at: Ts;
    expires_at: NullableDate;
    created_at: Ts;
    updated_at: Ts;
  };
  news_audience: {
    news_id: string;
    kind: string;
    value: Generated<string>;
  };
  news_reads: {
    news_id: string;
    user_id: string;
    read_at: Ts;
    acknowledged_at: NullableDate;
  };
  forum_threads: {
    id: Generated<string>;
    course_id: string;
    author_id: string;
    title: string;
    body: string;
    pinned: Generated<boolean>;
    locked: Generated<boolean>;
    posts_count: Generated<number>;
    last_post_at: Ts;
    created_at: Ts;
    summary: NullableString;
    summary_posts: number | null;
    summary_at: NullableDate;
  };
  forum_posts: {
    id: Generated<string>;
    thread_id: string;
    author_id: string;
    body: string;
    is_answer: Generated<boolean>;
    created_at: Ts;
  };
  forum_reactions: {
    post_id: string;
    user_id: string;
    kind: string;
    created_at: Ts;
  };
  forum_mentions: {
    post_id: string;
    user_id: string;
  };
  forum_attachments: {
    id: Generated<string>;
    thread_id: string;
    post_id: string | null;
    item_id: string;
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
  login_challenges: {
    id: Generated<string>;
    user_id: string;
    code_hash: string;
    attempts: Generated<number>;
    max_attempts: Generated<number>;
    expires_at: Date;
    used_at: NullableDate;
    ip: NullableString;
    created_at: Ts;
  };
  trusted_devices: {
    id: Generated<string>;
    user_id: string;
    token_hash: string;
    label: string;
    expires_at: Date;
    revoked_at: NullableDate;
    last_used_at: NullableDate;
    created_at: Ts;
  };
  webauthn_credentials: {
    id: Generated<string>;
    user_id: string;
    credential_id: string;
    public_key: Buffer;
    counter: ColumnType<string | number, number | undefined, number>;
    transports: NullableString;
    device_type: NullableString;
    backed_up: Generated<boolean>;
    label: string;
    last_used_at: NullableDate;
    created_at: Ts;
  };
  webauthn_challenges: {
    id: Generated<string>;
    user_id: NullableString;
    challenge: string;
    kind: string;
    expires_at: Date;
    used_at: NullableDate;
    created_at: Ts;
  };
  account_imports: {
    id: Generated<string>;
    actor_id: NullableString;
    kind: string;
    file_name: string;
    total_rows: Generated<number>;
    created_count: Generated<number>;
    skipped_count: Generated<number>;
    errors: JsonValue;
    created_at: Ts;
  };
  user_preferences: {
    user_id: string;
    companion: Generated<string>;
    theme: Generated<string>;
    weekly_digest: Generated<boolean>;
    digest_sent_at: NullableDate;
    updated_at: Ts;
  };
  risk_alert_notes: {
    id: Generated<string>;
    alert_id: string;
    author_id: string;
    body: string;
    created_at: Ts;
  };
  meetings: {
    id: Generated<string>;
    student_id: string;
    guardian_id: string;
    course_id: NullableString;
    alert_id: NullableString;
    created_by: string;
    scheduled_at: Ts;
    mode: Generated<string>;
    place: Generated<string>;
    reason: string;
    status: Generated<string>;
    response_note: NullableString;
    responded_at: NullableDate;
    outcome: NullableString;
    created_at: Ts;
  };
  guardian_messages: {
    id: Generated<string>;
    student_id: string;
    guardian_id: string;
    teacher_id: string;
    author_id: string;
    body: string;
    read_at: NullableDate;
    created_at: Ts;
  };
  staff_messages: {
    id: Generated<string>;
    sender_id: string;
    recipient_id: string;
    body: string;
    read_at: NullableDate;
    created_at: Ts;
  };
  bulletin_signatures: {
    id: Generated<string>;
    student_id: string;
    period_id: NullableString;
    requested_by: string;
    status: Generated<string>;
    signed_by: NullableString;
    signed_at: NullableDate;
    decision_note: NullableString;
    created_at: Ts;
  };
  legal_documents: {
    id: Generated<string>;
    kind: string;
    version: string;
    title: string;
    published_at: Ts;
  };
  legal_acceptances: {
    id: Generated<string>;
    user_id: string;
    document_id: string;
    accepted_by: string;
    ip: NullableString;
    accepted_at: Ts;
  };
  data_requests: {
    id: Generated<string>;
    user_id: string;
    kind: string;
    status: Generated<string>;
    reason: NullableString;
    resolved_by: NullableString;
    resolved_at: NullableDate;
    created_at: Ts;
  };
}
