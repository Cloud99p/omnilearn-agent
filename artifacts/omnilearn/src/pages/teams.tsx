/**
 * Teams Management Page
 * 
 * Features:
 * - View organizations and teams
 * - Invite members
 * - Assign roles
 * - Remove members
 * - View team activity
 */

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Users, Building2, Shield, UserPlus, Trash2, Edit2, Activity } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface Organization {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

interface Team {
  id: number;
  name: string;
  slug: string;
  description?: string;
  organizationId: number;
  organizationName?: string;
  role?: string;
}

interface TeamMember {
  id: number;
  clerkId: string;
  role: string;
  status: 'pending' | 'active' | 'suspended' | 'removed';
  joinedAt: string;
  expiresAt?: string;
  email?: string;
}

interface Role {
  id: number;
  name: string;
  displayName: string;
  description?: string;
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

export default function TeamsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────────────────────
  // Load Data
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load organizations
      const orgsRes = await fetchWithAuth(`${API_BASE}/access/organizations`);
      if (orgsRes.ok) {
        const orgs = await orgsRes.json();
        setOrganizations(orgs);
      }

      // Load teams
      const teamsRes = await fetchWithAuth(`${API_BASE}/access/teams`);
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
      }

      // Load roles
      const rolesRes = await fetchWithAuth(`${API_BASE}/access/roles`);
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }
    } catch (err) {
      setError('Failed to load teams data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Load Team Members
  // ────────────────────────────────────────────────────────────────────────────

  async function loadTeamMembers(teamId: number) {
    try {
      const res = await fetchWithAuth(`${API_BASE}/access/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Invite Member
  // ────────────────────────────────────────────────────────────────────────────

  async function inviteMember() {
    if (!selectedTeam || !inviteEmail) return;

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      // Note: In real implementation, you'd send invite email
      // For now, we'll just show the clerk ID input
      const res = await fetchWithAuth(
        `${API_BASE}/access/teams/${selectedTeam.id}/members`,
        {
          method: 'POST',
          body: JSON.stringify({
            clerkId: inviteEmail, // For now, treat as clerk ID
            roleId: roles.find(r => r.name === inviteRole)?.id,
            status: 'active',
          }),
        }
      );

      if (res.ok) {
        setSuccess('Member invited successfully!');
        setInviteDialogOpen(false);
        setInviteEmail('');
        loadTeamMembers(selectedTeam.id);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to invite member');
      }
    } catch (err) {
      setError('Failed to invite member');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Remove Member
  // ────────────────────────────────────────────────────────────────────────────

  async function removeMember(clerkId: string) {
    if (!selectedTeam) return;

    if (!confirm(`Remove this member from ${selectedTeam.name}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      const res = await fetchWithAuth(
        `${API_BASE}/access/teams/${selectedTeam.id}/members/${clerkId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setSuccess('Member removed successfully');
        loadTeamMembers(selectedTeam.id);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove member');
      }
    } catch (err) {
      setError('Failed to remove member');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Update Member Role
  // ────────────────────────────────────────────────────────────────────────────

  async function updateMemberRole(clerkId: string, newRole: string) {
    if (!selectedTeam) return;

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      const roleId = roles.find(r => r.name === newRole)?.id;
      if (!roleId) throw new Error('Role not found');

      // Remove and re-add with new role (simplified)
      await fetchWithAuth(
        `${API_BASE}/access/teams/${selectedTeam.id}/members/${clerkId}`,
        { method: 'DELETE' }
      );

      const res = await fetchWithAuth(
        `${API_BASE}/access/teams/${selectedTeam.id}/members`,
        {
          method: 'POST',
          body: JSON.stringify({
            clerkId,
            roleId,
            status: 'active',
          }),
        }
      );

      if (res.ok) {
        setSuccess('Role updated successfully');
        loadTeamMembers(selectedTeam.id);
      } else {
        setError('Failed to update role');
      }
    } catch (err) {
      setError('Failed to update role');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Teams</h1>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Teams</h1>
            <p className="text-muted-foreground">Manage your organizations and team members</p>
          </div>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 text-green-500 p-4 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* Organizations Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {organizations.map((org) => (
          <Card key={org.id} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5" />
              <h3 className="font-semibold">{org.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{org.description || 'No description'}</p>
            <Badge variant="secondary">@{org.slug}</Badge>
          </Card>
        ))}
        {organizations.length === 0 && (
          <Card className="p-4">
            <p className="text-muted-foreground">No organizations yet. Create one to get started!</p>
          </Card>
        )}
      </div>

      {/* Teams List */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Teams</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card
              key={team.id}
              className={`p-4 cursor-pointer transition-colors ${
                selectedTeam?.id === team.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                setSelectedTeam(team);
                loadTeamMembers(team.id);
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <h3 className="font-semibold">{team.name}</h3>
                </div>
                <Badge>{team.role}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {team.description || 'No description'}
              </p>
              <p className="text-xs text-muted-foreground">@{team.slug}</p>
              {team.organizationName && (
                <p className="text-xs text-muted-foreground mt-2">
                  Organization: {team.organizationName}
                </p>
              )}
            </Card>
          ))}
          {teams.length === 0 && (
            <Card className="p-4">
              <p className="text-muted-foreground">No teams yet. Join or create a team!</p>
            </Card>
          )}
        </div>
      </div>

      {/* Team Members */}
      {selectedTeam && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Members - {selectedTeam.name}
            </h2>
            <Button variant="outline" size="sm" onClick={() => loadTeamMembers(selectedTeam.id)}>
              <Activity className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {member.email?.[0]?.toUpperCase() || member.clerkId?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.email || 'User'}</p>
                        <p className="text-xs text-muted-foreground">{member.clerkId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onValueChange={(value) => updateMemberRole(member.clerkId, value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        member.status === 'active'
                          ? 'default'
                          : member.status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.expiresAt
                      ? new Date(member.expiresAt).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member.clerkId)}
                      disabled={actionLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {teamMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No members yet. Invite someone!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Clerk User ID</label>
              <Input
                placeholder="user_..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the Clerk user ID of the person you want to invite
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTeam && (
              <p className="text-xs text-muted-foreground">
                Inviting to: <strong>{selectedTeam.name}</strong>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={inviteMember} disabled={actionLoading || !inviteEmail}>
              {actionLoading ? 'Inviting...' : 'Send Invite'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
