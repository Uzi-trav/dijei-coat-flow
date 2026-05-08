export type Role = "superadmin" | "admin" | "editor";

export interface User {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  last_login: string | null;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "last_login">;
        Update: Partial<Omit<User, "id">>;
      };
    };
  };
}
