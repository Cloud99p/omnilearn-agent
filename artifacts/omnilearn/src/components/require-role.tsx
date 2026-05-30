/**
 * Role-Based Access Control Component
 * 
 * Protects pages by checking user's role before rendering.
 * Shows access denied message if user doesn't have required role.
 * 
 * Usage:
 * ```tsx
 * <RequireRole allowedRoles={['super_admin', 'org_admin']}>
 *   <TeamsPage />
 * </RequireRole>
 * ```
 */

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/react';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

type RoleName = 
  | 'super_admin'
  | 'org_admin'
  | 'team_lead'
  | 'member'
  | 'viewer'
  | 'guest';

interface RequireRoleProps {
  allowedRoles: RoleName[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface UserPermission {
  roles: RoleName[];
  teams: Array<{
    id: number;
    name: string;
    role: RoleName;
  }>;
  organization?: {
    id: number;
    name: string;
  };
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function fetchUserPermissions(): Promise<UserPermission | null> {
  try {
    const token = await window.Clerk?.session?.getToken();
    const res = await fetch(`${API_BASE}/access/permissions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch user permissions:', err);
    return null;
  }
}

export function RequireRole({ allowedRoles, children, fallback }: RequireRoleProps) {
  const { user, isLoaded } = useUser();
  const [permissions, setPermissions] = useState<UserPermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) {
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [isLoaded, user]);

  async function loadPermissions() {
    try {
      setLoading(true);
      const perms = await fetchUserPermissions();
      setPermissions(perms);

      if (perms && perms.roles) {
        const userHasRole = allowedRoles.some(role => 
          perms.roles.includes(role)
        );
        setHasAccess(userHasRole);
      } else {
        setHasAccess(false);
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to access this page.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Required roles: {allowedRoles.join(', ')}
              </p>
            </div>
            {permissions && permissions.roles.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Your roles:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {permissions.roles.map((role) => (
                    <span
                      key={role}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Button className="mt-4" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Convenience wrappers
export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  return <RequireRole allowedRoles={['super_admin']}>{children}</RequireRole>;
}

export function RequireOrgAdmin({ children }: { children: React.ReactNode }) {
  return <RequireRole allowedRoles={['org_admin', 'super_admin']}>{children}</RequireRole>;
}

export function RequireTeamLead({ children }: { children: React.ReactNode }) {
  return <RequireRole allowedRoles={['team_lead', 'org_admin', 'super_admin']}>{children}</RequireRole>;
}

export default RequireRole;
