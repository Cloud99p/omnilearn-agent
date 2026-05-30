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
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: number;
  clerkId: string;
  action: string;
  resourceType?: string;
  resourceId?: number;
  decision: 'ALLOW' | 'DENY';
  reason?: string;
  context?: {
    ip?: string;
    userAgent?: string;
    location?: string;
  };
  createdAt: string;
  location?: 'current' | 'archived';
}

// ──────────────────────────────────────────────────────────────────────────────
// API Helpers
// ──────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [daysFilter, setDaysFilter] = useState('7');
  const [securityEventsOnly, setSecurityEventsOnly] = useState(false);

  // ────────────────────────────────────────────────────────────────────────────
  // Load Audit Logs
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadLogs();
  }, [daysFilter, securityEventsOnly]);

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
        setFilteredLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Filter Logs
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let filtered = [...logs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.clerkId.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query) ||
          log.resourceType?.toLowerCase().includes(query) ||
          log.reason?.toLowerCase().includes(query)
      );
    }

    // Decision filter
    if (decisionFilter !== 'all') {
      filtered = filtered.filter((log) => log.decision === decisionFilter);
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    // Resource filter
    if (resourceFilter !== 'all') {
      filtered = filtered.filter((log) => log.resourceType === resourceFilter);
    }

    setFilteredLogs(filtered);
  }, [searchQuery, decisionFilter, actionFilter, resourceFilter, logs]);

  // ────────────────────────────────────────────────────────────────────────────
  // Export Logs
  // ────────────────────────────────────────────────────────────────────────────

  function exportLogs() {
    const csv = [
      ['ID', 'User', 'Action', 'Resource', 'Resource ID', 'Decision', 'Reason', 'IP', 'Timestamp'].join(','),
      ...filteredLogs.map((log) =>
        [
          log.id,
          log.clerkId,
          log.action,
          log.resourceType || '',
          log.resourceId || '',
          log.decision,
          log.reason || '',
          log.context?.ip || '',
          new Date(log.createdAt).toISOString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Get unique actions and resources for filters
  // ────────────────────────────────────────────────────────────────────────────

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));
  const uniqueResources = Array.from(new Set(logs.map((log) => log.resourceType).filter(Boolean)));

  // ────────────────────────────────────────────────────────────────────────────
  // Stats
  // ────────────────────────────────────────────────────────────────────────────

  const stats = {
    total: logs.length,
    allowed: logs.filter((l) => l.decision === 'ALLOW').length,
    denied: logs.filter((l) => l.decision === 'DENY').length,
    uniqueUsers: new Set(logs.map((l) => l.clerkId)).size,
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
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
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Unique Users</p>
          <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
        </Card>
      </div>

      {/* Security Events Alert */}
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
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setSecurityEventsOnly(!securityEventsOnly)}
            >
              {securityEventsOnly ? 'Show All' : 'View Only'}
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, resource..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Decision Filter */}
          <div>
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
          </div>

          {/* Action Filter */}
          <div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resource Filter */}
          <div>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {uniqueResources.map((resource) => (
                  <SelectItem key={resource} value={resource}>
                    {resource}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Time Range */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Time range:</span>
          </div>
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
          <Button
            variant={securityEventsOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSecurityEventsOnly(!securityEventsOnly)}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Security Events Only
          </Button>
        </div>
      </Card>

      {/* Logs Table */}
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
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {log.clerkId[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <code className="text-xs">{log.clerkId}</code>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{log.action}</Badge>
                </TableCell>
                <TableCell>
                  {log.resourceType ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{log.resourceType}</span>
                      {log.resourceId && (
                        <span className="text-xs text-muted-foreground">#{log.resourceId}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={log.decision === 'ALLOW' ? 'default' : 'destructive'}
                    className="gap-1"
                  >
                    {log.decision === 'ALLOW' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {log.decision}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {log.reason || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.context?.ip || '-'}
                </TableCell>
              </TableRow>
            ))}
            {filteredLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {loading ? 'Loading...' : 'No audit logs found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results Summary */}
      <div className="mt-4 text-sm text-muted-foreground text-center">
        Showing {filteredLogs.length} of {logs.length} events
        {searchQuery && ` (filtered from "${searchQuery}")`}
      </div>
    </div>
  );
}
