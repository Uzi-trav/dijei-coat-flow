import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { hasMinRole } from "@/hooks/useRole";
import type { Role } from "@/types/database";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, role, loading } = useAuth();

  if (loading) return null;

  if (!session) return <Navigate to="/login" replace />;

  if (requiredRole && !hasMinRole(role, requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
