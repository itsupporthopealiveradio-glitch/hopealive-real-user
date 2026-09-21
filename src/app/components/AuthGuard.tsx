import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { wampMe } from "../../lib/wampApi";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      if (!mounted) return;
      try {
        const user = await wampMe();
        if (requireAdmin && user.role !== "admin") throw new Error("Access denied");
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
        setIsLoading(false);
        navigate("/", { replace: true, state: { from: location } });
        return;
      }
      setIsLoading(false);
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [navigate, location]);

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
    </div>;
  }

  return isAuthenticated ? <>{children}</> : null;
}
