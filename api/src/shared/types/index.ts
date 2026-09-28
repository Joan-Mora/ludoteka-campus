export type Role = "student" | "teacher" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type IntegrityType = "blur" | "visibility" | "escape" | "fullscreen_exit";