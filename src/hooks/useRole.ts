import { useAuth } from "./useAuth";
import type { Role } from "@/types/database";

export function useRole(): Role | null {
  const { role } = useAuth();
  return role;
}

export function hasMinRole(userRole: Role | null, required: Role): boolean {
  const levels: Record<Role, number> = {
    superadmin: 3,
    admin: 2,
    editor: 1,
  };
  if (!userRole) return false;
  return levels[userRole] >= levels[required];
}
