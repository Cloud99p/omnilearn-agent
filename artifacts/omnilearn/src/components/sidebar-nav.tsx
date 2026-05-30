/**
 * Sidebar Navigation with Role-Based Visibility
 * 
 * Navigation items are hidden based on user roles.
 * Users won't see pages they don't have access to.
 */

import { Link, useLocation } from 'react-router-dom';
import { useHasRole } from '../hooks/use-permissions';
import {
  Home,
  Users,
  Shield,
  Brain,
  Settings,
  FileText,
  Database,
  GitBranch,
  Activity,
  Cpu,
  User,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles?: Array<'super_admin' | 'org_admin' | 'team_lead' | 'member' | 'viewer' | 'guest'>;
}

const navItems: NavItem[] = [
  {
    title: 'Home',
    href: '/',
    icon: Home,
  },
  {
    title: 'Chat',
    href: '/chat',
    icon: Brain,
    requiredRoles: ['member', 'team_lead', 'org_admin', 'super_admin'],
  },
  {
    title: 'Teams',
    href: '/teams',
    icon: Users,
    requiredRoles: ['team_lead', 'org_admin', 'super_admin'], // Hidden for regular members
  },
  {
    title: 'Audit Logs',
    href: '/audit-logs',
    icon: Shield,
    requiredRoles: ['org_admin', 'super_admin'], // Hidden for team_lead and below
  },
  {
    title: 'Intelligence',
    href: '/intelligence',
    icon: Cpu,
  },
  {
    title: 'Memory',
    href: '/memory',
    icon: Database,
  },
  {
    title: 'Network',
    href: '/network',
    icon: GitBranch,
  },
  {
    title: 'Personality',
    href: '/personality',
    icon: Activity,
  },
  {
    title: 'Account',
    href: '/account',
    icon: User,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function SidebarNav() {
  const location = useLocation();
  const { hasRole: isSuperAdmin } = useHasRole(['super_admin']);
  const { hasRole: isOrgAdmin } = useHasRole(['org_admin', 'super_admin']);
  const { hasRole: isTeamLead } = useHasRole(['team_lead', 'org_admin', 'super_admin']);

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        // Check if user has required role
        let shouldShow = true;
        
        if (item.requiredRoles) {
          if (item.title === 'Teams' && !isTeamLead) shouldShow = false;
          if (item.title === 'Audit Logs' && !isOrgAdmin) shouldShow = false;
          // Add more specific checks as needed
        }

        if (!shouldShow) {
          return null; // Don't render at all
        }

        const Icon = item.icon;
        const isActive = location.pathname === item.href;

        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="w-5 h-5" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

export default SidebarNav;
