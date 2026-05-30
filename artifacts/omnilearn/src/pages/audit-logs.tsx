/**
 * Audit Logs Page
 * 
 * Features:
 * - View all audit logs
 * - Filter by action, resource, decision
 * - Search by user
 * - Security events (DENY decisions)
 * - Export logs
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { RequireRole } from '../components/require-role';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Shield,
  Search,
  RefreshCw,
  Download,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface AuditLog {
  id: number;
  clerkId: string;
  action: string;
  resourceType?: string;
  resourceId?: number;
  decision: 'ALLOW' | 'DENY';
  reason?: string;
  context?: { ip?: string; userAgent?: string; location?: string };
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://workspaceapi-server-production-29ee.up.railway.app/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await window.Clerk?.session?.getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

function AuditLogsContent() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('7');
  const [securityEventsOnly, setSecurityEventsOnly] = useState(false);

  useEffect(() => { loadLogs(); }, [daysFilter, securityEventsOnly]);

  async function loadLogs() {
    try {
      setLoading(true);
      const url = securityEventsOnly
        ? `${API_BASE}/access/audit-logs/security-events?daysBack=${daysFilter}`
        : `${API_BASE}/access/audit-logs?limit=100&offset=0`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let filtered = [...logs];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) => log.clerkId.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query) ||
          log.resourceType?.toLowerCase().includes(query)
      );
    }
    if (decisionFilter !== 'all') {
      filtered = filtered.filter((log) => log.decision === decisionFilter);
    }
    setLogs(filtered);
  }, [searchQuery, decisionFilter, logs]);

  function exportLogs() {
    const csv = [
      ['ID', 'User', 'Action', 'Resource', 'Decision', 'Reason', 'IP', 'Timestamp'].join(','),
      ...logs.map((log) => [log.id, log.clerkId, log.action, log.resourceType || '', log.decision, log.reason || '', log.context?.ip || '', new Date(log.createdAt).toISOString()].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = {
    total: logs.length,
    allowed: logs.filter((l) => l.decision === 'ALLOW').length,
    denied: logs.filter((l) => l.decision === 'DENY').length,
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Audit Logs</h1>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">Track all access and security events</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadLogs()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Events</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-sm text-muted-foreground">Allowed</p>
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.allowed}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-muted-foreground">Denied</p>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.denied}</p>
        </Card>
      </div>

      {stats.denied > 0 && (
        <Card className="p-4 mb-6 bg-red-500/10 border-red-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <p className="font-medium text-red-500">Security Events Detected</p>
              <p className="text-sm text-red-400">
                {stats.denied} access denial{stats.denied > 1 ? 's' : ''} in the last {daysFilter} days
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSecurityEventsOnly(!securityEventsOnly)}>
              {securityEventsOnly ? 'Show All' : 'View Only'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Input
              placeholder="Search by user, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={decisionFilter} onValueChange={setDecisionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Decision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Decisions</SelectItem>
              <SelectItem value="ALLOW">Allowed</SelectItem>
              <SelectItem value="DENY">Denied</SelectItem>
            </SelectContent>
          </Select>
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">{new Date(log.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium">{log.clerkId[0]?.toUpperCase() || 'U'}</span>
                    </div>
                    <code className="text-xs">{log.clerkId}</code>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                <TableCell>{log.resourceType ? log.resourceType : '-'}</TableCell>
                <TableCell>
                  <Badge variant={log.decision === 'ALLOW' ? 'default' : 'destructive'}>
                    {log.decision}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {log.reason || '-'}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No audit logs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// Export with role protection (org_admin or super_admin only)
export default function AuditLogsPage() {
  return (
    <RequireRole allowedRoles={['org_admin', 'super_admin']}>
      <AuditLogsContent />
    </RequireRole>
  );
}
