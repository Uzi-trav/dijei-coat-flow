export type Role = "superadmin" | "admin" | "editor";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface User {
  [key: string]: unknown;
  id: string;
  email: string;
  role: Role;
  created_at: string;
  last_login: string | null;
}

export interface Project {
  [key: string]: unknown;
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Item {
  [key: string]: unknown;
  id: string;
  canonical_name: string;
  part_numbers: string[];
  is_active: boolean;
  created_at: string;
}

export interface WorkRecord {
  [key: string]: unknown;
  id: string;
  record_number: string;
  project_id: string;
  lot_number: string;
  inspector_id: string;
  created_at: string;
  status: string;
  notes: string | null;
  is_rework: boolean;
}

export interface WorkRecordItem {
  [key: string]: unknown;
  id: string;
  work_record_id: string;
  item_id: string | null;
  item_name_snapshot: string;
  part_number: string | null;
  quantity: number;
  unit: string;
  proposed_new_item: boolean;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "last_login">;
        Update: Partial<Omit<User, "id">>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: { name: string; is_active?: boolean };
        Update: { name?: string; is_active?: boolean };
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: {
          canonical_name: string;
          part_numbers?: string[];
          is_active?: boolean;
        };
        Update: {
          canonical_name?: string;
          part_numbers?: string[];
          is_active?: boolean;
        };
        Relationships: [];
      };
      work_records: {
        Row: WorkRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      work_record_items: {
        Row: WorkRecordItem;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      coatx_shared_data: {
        Row: {
          id: string;
          entity_type: "project" | "item" | "work_record";
          payload: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          entity_type: "project" | "item" | "work_record";
          payload: Json;
        };
        Update: {
          payload?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      submit_work_record: {
        Args: {
          p_project_id: string;
          p_lot_number: string;
          p_notes: string;
          p_items: Json;
        };
        Returns: string;
      };
    };
  };
}
