/**
 * Hook to check user permissions
 * 
 * Usage:
 * ```tsx
 * const { hasRole, isLoading } = useHasRole(['super_admin', 'org_admin']);
 * 
 * if (hasRole) {
 *   return <AdminPanel />;
 * }
 * return null; // Don't render at all
 * ```
 */

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/react';

type RoleName = 
  | 'super_admin'
  | 'org_admin'
  | 'team_lead'
  | 'member'
  | 'viewer'
  | 'guest';

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

const API_BASE = (import.meta.env.VITE_API_URL || 'https://workspaceapi-server-production-29ee.up.railway.app/api').replace(/\/api$/, '') + '/api';

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

export function useHasRole(allowedRoles: RoleName[]): {
  hasRole: boolean;
  isLoading: boolean;
  roles: RoleName[];
} {
  const { user, isLoaded } = useUser();
  const [permissions, setPermissions] = useState<UserPermission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) {
      setIsLoading(false);
      return;
    }

    loadPermissions();
  }, [isLoaded, user]);

  async function loadPermissions() {
    try {
      setIsLoading(true);
      const perms = await fetchUserPermissions();
      setPermissions(perms);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const hasRole = permissions?.roles?.some(role => allowedRoles.includes(role)) ?? false;
  const roles = permissions?.roles ?? [];

  return { hasRole, isLoading, roles };
}

// Convenience hooks for specific roles
export function useIsSuperAdmin() {
  return useHasRole(['super_admin']);
}

export function useIsOrgAdmin() {
  return useHasRole(['org_admin', 'super_admin']);
}

export function useIsTeamLead() {
  return useHasRole(['team_lead', 'org_admin', 'super_admin']);
}

export function useIsMember() {
  return useHasRole(['member', 'team_lead', 'org_admin', 'super_admin']);
}

export default useHasRole;
