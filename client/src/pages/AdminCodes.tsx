import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Copy, Key, Shield, Ban, RotateCcw, BarChart3, Users, FolderTree, Upload, Search, Plus, Trash2, Edit, UserPlus, Download, ChevronLeft, ChevronRight, Star, UserMinus, ClipboardList, Check, X, ExternalLink, FileText, Send, Flag, UserX, Settings } from 'lucide-react';
import { Link } from 'wouter';
import AdminAnalytics from './AdminAnalytics';

interface UnlockCode {
  id: string;
  code: string;
  creditsToAdd: number;
  grantsUnlimited: boolean;
  allowedCountries: string[];
  notes: string | null;
  isUsed: boolean;
  isRevoked: boolean;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionTier: string;
  subscriptionStatus: string | null;
  createdAt: string;
  groups: { id: string; name: string }[];
  credits?: { credits: number; isUnlimited: boolean } | null;
}

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  accessControls: GroupAccessControls;
  createdAt: string;
  memberCount?: number;
}

interface GroupAccessControls {
  unlimitedCredits?: boolean;
  subscriptionTierOverride?: 'free' | 'advanced' | 'pro';
  bypassCreditCheck?: boolean;
  monthlyCreditsOverride?: number;
  features?: string[];
}

interface WaitlistUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isBeta: boolean | null;
  betaGrantedAt: string | null;
  waitlistRequestedAt: string | null;
  waitlistRejectedAt: string | null;
  waitlistRole: string | null;
  waitlistUseCase: string | null;
  createdAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  pm: 'Product Manager',
  design: 'Designer',
  engineering: 'Engineer',
  founder: 'Founder / CEO',
};

const AVAILABLE_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
];

const SUBSCRIPTION_TIERS = ['free', 'advanced', 'pro'] as const;

function WaitlistTab({ authHeader }: { authHeader: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'beta' | 'rejected'>('pending');
  const [searchEmail, setSearchEmail] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Debounce search input
  const searchTimeoutRef = useCallback((value: string) => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchEmail(value);
    searchTimeoutRef(value);
  };

  const { data: waitlistData, isLoading, refetch } = useQuery({
    queryKey: ['/internal/x9k7m2p4/waitlist', statusFilter, page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: String(limit),
        offset: String((page - 1) * limit),
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const response = await fetch(`/internal/x9k7m2p4/waitlist?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch waitlist');
      return response.json();
    },
  });

  const grantBetaMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/internal/x9k7m2p4/beta/grant', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to grant beta access' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: 'Beta Access Granted', description: 'User can now access the app' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const revokeBetaMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/internal/x9k7m2p4/beta/revoke', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to revoke beta access' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: 'Beta Access Revoked', description: 'User access has been revoked' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/internal/x9k7m2p4/waitlist/reject', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to reject waitlist request' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: 'Request Rejected', description: 'Waitlist request has been rejected' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const waitlistUsers: WaitlistUser[] = waitlistData?.users || [];
  const filteredTotal = waitlistData?.total || 0;
  const totalPages = Math.ceil(filteredTotal / limit);

  // Use server-side stats for accurate metrics
  const stats = waitlistData?.stats || { total: 0, pending: 0, approved: 0, rejected: 0 };
  const conversionRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Waitlist Requests
          </CardTitle>
          <CardDescription>
            Manage beta access requests from the landing page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchEmail}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                  data-testid="input-waitlist-search"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-40" data-testid="select-waitlist-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="beta">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : waitlistUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No waitlist requests found</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Email</th>
                    <th className="text-left p-3 text-sm font-medium">Role</th>
                    <th className="text-left p-3 text-sm font-medium">Use Case</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Requested</th>
                    <th className="text-right p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlistUsers.map((user) => (
                    <tr key={user.id} className="border-t" data-testid={`row-waitlist-${user.id}`}>
                      <td className="p-3 text-sm font-medium">{user.email || '-'}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {user.waitlistRole ? ROLE_LABELS[user.waitlistRole] || user.waitlistRole : '-'}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground max-w-xs truncate" title={user.waitlistUseCase || undefined}>
                        {user.waitlistUseCase || '-'}
                      </td>
                      <td className="p-3">
                        {user.isBeta ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Approved
                          </Badge>
                        ) : user.waitlistRejectedAt ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Rejected
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDate(user.waitlistRequestedAt)}
                      </td>
                      <td className="p-3 text-right">
                        {user.isBeta ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeBetaMutation.mutate(user.id)}
                            disabled={revokeBetaMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`button-revoke-${user.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
                        ) : user.waitlistRejectedAt ? (
                          <span className="text-sm text-muted-foreground">-</span>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => grantBetaMutation.mutate(user.id)}
                              disabled={grantBetaMutation.isPending}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              data-testid={`button-approve-${user.id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => rejectMutation.mutate(user.id)}
                              disabled={rejectMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              data-testid={`button-reject-${user.id}`}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({filteredTotal} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab({ authHeader }: { authHeader: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTier, setEditTier] = useState<string>('free');
  const [editCredits, setEditCredits] = useState<number>(0);
  const [editUnlimited, setEditUnlimited] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const limit = 20;

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/internal/users', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const response = await fetch(`/internal/users?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ['/internal/groups'],
    queryFn: async () => {
      const response = await fetch('/internal/groups', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; subscriptionTier: string }) => {
      const response = await fetch(`/internal/users/${data.userId}`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionTier: data.subscriptionTier }),
      });
      if (!response.ok) throw new Error('Failed to update user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/users'] });
      toast({ title: 'User Updated', description: 'Subscription tier updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateCreditsMutation = useMutation({
    mutationFn: async (data: { userId: string; credits: number; isUnlimited: boolean }) => {
      const response = await fetch(`/internal/users/${data.userId}/credits`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: data.credits, isUnlimited: data.isUnlimited }),
      });
      if (!response.ok) throw new Error('Failed to update credits');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/users'] });
      toast({ title: 'Credits Updated', description: 'User credits updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateGroupsMutation = useMutation({
    mutationFn: async (data: { userId: string; groupIds: string[] }) => {
      const response = await fetch(`/internal/users/${data.userId}/groups`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: data.groupIds }),
      });
      if (!response.ok) throw new Error('Failed to update groups');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/users'] });
      toast({ title: 'Groups Updated', description: 'User group memberships updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditTier(user.subscriptionTier || 'free');
    setEditCredits(user.credits?.credits || 0);
    setEditUnlimited(user.credits?.isUnlimited || false);
    setSelectedGroups(user.groups?.map(g => g.id) || []);
    setEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    await updateUserMutation.mutateAsync({ userId: selectedUser.id, subscriptionTier: editTier });
    await updateCreditsMutation.mutateAsync({ userId: selectedUser.id, credits: editCredits, isUnlimited: editUnlimited });
    await updateGroupsMutation.mutateAsync({ userId: selectedUser.id, groupIds: selectedGroups });
    
    setEditDialogOpen(false);
    setSelectedUser(null);
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Search and manage user accounts, subscriptions, and group memberships
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
                data-testid="input-user-search"
              />
            </div>
          </div>

          {usersLoading ? (
            <p className="text-muted-foreground">Loading users...</p>
          ) : (
            <>
              <div className="space-y-2">
                {usersData?.users?.map((user: User) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.email || 'No email'}</span>
                        <Badge variant={user.subscriptionTier === 'pro' ? 'default' : user.subscriptionTier === 'advanced' ? 'secondary' : 'outline'}>
                          {user.subscriptionTier || 'free'}
                        </Badge>
                        {user.credits?.isUnlimited && (
                          <Badge variant="default" className="bg-purple-600">Unlimited</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.firstName} {user.lastName} • Credits: {user.credits?.isUnlimited ? '∞' : (user.credits?.credits ?? 'N/A')}
                      </div>
                      {user.groups && user.groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.groups.map(group => (
                            <Badge key={group.id} variant="outline" className="text-xs">
                              {group.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link href={`/internal/x9k7m2p4/users/${user.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-view-user-${user.id}`}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil((usersData?.total || 0) / limit)} ({usersData?.total || 0} users)
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= Math.ceil((usersData?.total || 0) / limit)}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update {selectedUser?.email}'s subscription, credits, and group memberships
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select value={editTier} onValueChange={setEditTier}>
                <SelectTrigger data-testid="select-subscription-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_TIERS.map(tier => (
                    <SelectItem key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Unlimited Credits</Label>
                <Switch
                  checked={editUnlimited}
                  onCheckedChange={setEditUnlimited}
                  data-testid="switch-unlimited-credits"
                />
              </div>
              {!editUnlimited && (
                <div className="space-y-2">
                  <Label>Credits</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editCredits}
                    onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)}
                    data-testid="input-credits"
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Group Memberships</Label>
              <ScrollArea className="h-40 border rounded-md p-2">
                {groupsData?.groups?.map((group: UserGroup) => (
                  <div key={group.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={selectedGroups.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                      data-testid={`checkbox-group-${group.id}`}
                    />
                    <Label htmlFor={`group-${group.id}`} className="cursor-pointer text-sm font-normal flex-1">
                      {group.name}
                      {group.description && <span className="text-muted-foreground ml-2">({group.description})</span>}
                    </Label>
                  </div>
                ))}
                {(!groupsData?.groups || groupsData.groups.length === 0) && (
                  <p className="text-sm text-muted-foreground">No groups available</p>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending || updateCreditsMutation.isPending || updateGroupsMutation.isPending}
              data-testid="button-save-user"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupsTab({ authHeader }: { authHeader: string }) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [accessControls, setAccessControls] = useState<GroupAccessControls>({});

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['/internal/groups'],
    queryFn: async () => {
      const response = await fetch('/internal/groups', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; accessControls: GroupAccessControls }) => {
      const response = await fetch('/internal/groups', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to create group' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      toast({ title: 'Group Created', description: 'New group created successfully' });
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (data: { groupId: string; name: string; description: string; accessControls: GroupAccessControls }) => {
      const response = await fetch(`/internal/groups/${data.groupId}`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, description: data.description, accessControls: data.accessControls }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to update group' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      toast({ title: 'Group Updated', description: 'Group updated successfully' });
      setEditDialogOpen(false);
      setSelectedGroup(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/internal/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to delete group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      toast({ title: 'Group Deleted', description: 'Group deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setGroupName('');
    setGroupDescription('');
    setAccessControls({});
  };

  const openEditDialog = (group: UserGroup) => {
    setSelectedGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setAccessControls(group.accessControls || {});
    setEditDialogOpen(true);
  };

  const AccessControlsEditor = ({ value, onChange }: { value: GroupAccessControls; onChange: (v: GroupAccessControls) => void }) => (
    <div className="space-y-4 p-4 border rounded-lg bg-accent/20">
      <h4 className="font-medium">Access Controls</h4>
      
      <div className="flex items-center justify-between">
        <div>
          <Label>Unlimited Credits</Label>
          <p className="text-xs text-muted-foreground">Members have unlimited AI credits</p>
        </div>
        <Switch
          checked={value.unlimitedCredits || false}
          onCheckedChange={(checked) => onChange({ ...value, unlimitedCredits: checked })}
          data-testid="switch-group-unlimited"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Bypass Credit Check</Label>
          <p className="text-xs text-muted-foreground">Skip credit verification entirely</p>
        </div>
        <Switch
          checked={value.bypassCreditCheck || false}
          onCheckedChange={(checked) => onChange({ ...value, bypassCreditCheck: checked })}
          data-testid="switch-group-bypass"
        />
      </div>

      <div className="space-y-2">
        <Label>Subscription Tier Override</Label>
        <Select
          value={value.subscriptionTierOverride || 'none'}
          onValueChange={(v) => onChange({ ...value, subscriptionTierOverride: v === 'none' ? undefined : v as any })}
        >
          <SelectTrigger data-testid="select-group-tier-override">
            <SelectValue placeholder="No override" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No override</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Monthly Credits Override</Label>
        <Input
          type="number"
          min="0"
          placeholder="Leave empty for default"
          value={value.monthlyCreditsOverride || ''}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : undefined;
            onChange({ ...value, monthlyCreditsOverride: val });
          }}
          data-testid="input-group-credits-override"
        />
      </div>

      <div className="space-y-2">
        <Label>Feature Flags (comma-separated)</Label>
        <Input
          placeholder="e.g., beta_features, early_access"
          value={value.features?.join(', ') || ''}
          onChange={(e) => {
            const features = e.target.value ? e.target.value.split(',').map(f => f.trim()).filter(Boolean) : undefined;
            onChange({ ...value, features });
          }}
          data-testid="input-group-features"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="w-5 h-5" />
                Group Management
              </CardTitle>
              <CardDescription>
                Create and manage user groups with access controls
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-group">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                  <DialogDescription>
                    Define a new user group with access controls
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g., Beta Testers"
                      data-testid="input-group-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      placeholder="Group purpose and notes..."
                      data-testid="input-group-description"
                    />
                  </div>
                  <AccessControlsEditor value={accessControls} onChange={setAccessControls} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { resetForm(); setCreateDialogOpen(false); }}>Cancel</Button>
                  <Button
                    onClick={() => createGroupMutation.mutate({ name: groupName, description: groupDescription, accessControls })}
                    disabled={!groupName.trim() || createGroupMutation.isPending}
                    data-testid="button-submit-create-group"
                  >
                    Create Group
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading groups...</p>
          ) : (
            <div className="space-y-2">
              {groupsData?.groups?.map((group: UserGroup) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`group-row-${group.id}`}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{group.name}</span>
                      <Badge variant="outline">{group.memberCount || 0} members</Badge>
                      {group.accessControls?.unlimitedCredits && (
                        <Badge variant="default" className="bg-purple-600">Unlimited</Badge>
                      )}
                      {group.accessControls?.bypassCreditCheck && (
                        <Badge variant="secondary">Bypass Credits</Badge>
                      )}
                      {group.accessControls?.subscriptionTierOverride && (
                        <Badge variant="outline">{group.accessControls.subscriptionTierOverride} tier</Badge>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/internal/x9k7m2p4/groups/${group.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-view-group-${group.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Delete group "${group.name}"? This will remove all members from the group.`)) {
                          deleteGroupMutation.mutate(group.id);
                        }
                      }}
                      disabled={deleteGroupMutation.isPending}
                      data-testid={`button-delete-group-${group.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!groupsData?.groups || groupsData.groups.length === 0) && (
                <p className="text-muted-foreground text-center py-8">No groups created yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group settings and access controls
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                data-testid="input-edit-group-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                data-testid="input-edit-group-description"
              />
            </div>
            <AccessControlsEditor value={accessControls} onChange={setAccessControls} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedGroup && updateGroupMutation.mutate({
                groupId: selectedGroup.id,
                name: groupName,
                description: groupDescription,
                accessControls
              })}
              disabled={!groupName.trim() || updateGroupMutation.isPending}
              data-testid="button-submit-edit-group"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const BETA_GROUP_NAME = 'Beta';
const BETA_GROUP_DESCRIPTION = 'Beta testers with Pro-tier access';
const BETA_GROUP_ACCESS_CONTROLS: GroupAccessControls = {
  subscriptionTierOverride: 'pro',
  unlimitedCredits: false,
  bypassCreditCheck: false,
};

function BetaUsersTab({ authHeader }: { authHeader: string }) {
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['/internal/groups'],
    queryFn: async () => {
      const response = await fetch('/internal/groups', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
  });

  const betaGroup = groupsData?.groups?.find((g: UserGroup) => g.name === BETA_GROUP_NAME);

  const { data: betaGroupDetails, isLoading: membersLoading, refetch: refetchMembers } = useQuery({
    queryKey: ['/internal/groups', betaGroup?.id, 'details'],
    queryFn: async () => {
      if (!betaGroup?.id) return null;
      const response = await fetch(`/internal/groups/${betaGroup.id}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch group details');
      return response.json();
    },
    enabled: !!betaGroup?.id,
  });

  const createBetaGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/internal/groups', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: BETA_GROUP_NAME,
          description: BETA_GROUP_DESCRIPTION,
          accessControls: BETA_GROUP_ACCESS_CONTROLS,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to create Beta group' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      toast({ title: 'Beta Group Created', description: 'Beta group with Pro-tier access has been created' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!betaGroup?.id) throw new Error('Beta group not found');
      const response = await fetch(`/internal/groups/${betaGroup.id}/members`, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to add member' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      refetchMembers();
      setSearchEmail('');
      setSearchResults([]);
      toast({ title: 'User Added', description: 'User added to Beta group successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!betaGroup?.id) throw new Error('Beta group not found');
      const response = await fetch(`/internal/groups/${betaGroup.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to remove member' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      refetchMembers();
      toast({ title: 'User Removed', description: 'User removed from Beta group' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`/internal/users?search=${encodeURIComponent(searchEmail)}&limit=10`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      toast({ title: 'Search Failed', description: 'Could not search for users', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const members = betaGroupDetails?.group?.members || [];
  const memberIds = new Set(members.map((m: any) => m.id));

  if (groupsLoading) {
    return <p className="text-muted-foreground p-4">Loading...</p>;
  }

  if (!betaGroup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Beta Users
          </CardTitle>
          <CardDescription>
            The Beta group doesn't exist yet. Create it to start managing beta users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 border-2 border-dashed rounded-lg text-center space-y-4">
            <Star className="w-12 h-12 mx-auto text-yellow-500" />
            <div>
              <p className="font-medium mb-2">Create Beta Group</p>
              <p className="text-sm text-muted-foreground mb-4">
                This will create a "Beta" group with Pro-tier subscription access for all members.
              </p>
            </div>
            <Button
              onClick={() => createBetaGroupMutation.mutate()}
              disabled={createBetaGroupMutation.isPending}
              data-testid="button-create-beta-group"
            >
              <Plus className="w-4 h-4 mr-2" />
              {createBetaGroupMutation.isPending ? 'Creating...' : 'Create Beta Group'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Add Users to Beta
          </CardTitle>
          <CardDescription>
            Search for users by email and add them to the Beta group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
                data-testid="input-beta-user-search"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search-beta-users">
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 border rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Search Results</p>
              {searchResults.map((user) => {
                const isAlreadyMember = memberIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                    data-testid={`search-result-${user.id}`}
                  >
                    <div>
                      <p className="font-medium">{user.email || 'No email'}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.firstName} {user.lastName} • {user.subscriptionTier || 'free'}
                      </p>
                    </div>
                    {isAlreadyMember ? (
                      <Badge variant="secondary">Already in Beta</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => addMemberMutation.mutate(user.id)}
                        disabled={addMemberMutation.isPending}
                        data-testid={`button-add-to-beta-${user.id}`}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Add to Beta
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Beta Group Members ({members.length})
          </CardTitle>
          <CardDescription>
            Users in the Beta group have Pro-tier access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <p className="text-muted-foreground">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No users in the Beta group yet. Use the search above to add users.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50"
                  data-testid={`beta-member-${member.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.email || 'No email'}</span>
                      <Badge variant="default" className="bg-yellow-500/80 hover:bg-yellow-500">
                        Beta
                      </Badge>
                      <Badge variant="outline">
                        {member.subscriptionTier || 'free'} → Pro
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {member.firstName} {member.lastName}
                      {member.addedAt && ` • Added ${new Date(member.addedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeMemberMutation.mutate(member.id)}
                    disabled={removeMemberMutation.isPending}
                    data-testid={`button-remove-from-beta-${member.id}`}
                  >
                    <UserMinus className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DocAccessGrant {
  id: string;
  email: string;
  grantedByAdminId: string | null;
  grantedAt: string;
  revokedAt: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
}

function DocsAccessTab({ authHeader }: { authHeader: string }) {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState('');

  const { data: grantsData, isLoading } = useQuery({
    queryKey: ['/internal/x9k7m2p4/docs-access'],
    queryFn: async () => {
      const response = await fetch('/internal/x9k7m2p4/docs-access', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch docs access grants');
      return response.json();
    },
  });

  const grantMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/internal/x9k7m2p4/docs-access', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to grant access' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/x9k7m2p4/docs-access'] });
      setNewEmail('');
      toast({ title: 'Access granted', description: 'Send a login link to complete setup.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (grantId: string) => {
      const response = await fetch(`/internal/x9k7m2p4/docs-access/${grantId}/revoke`, {
        method: 'POST',
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to revoke access');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/x9k7m2p4/docs-access'] });
      toast({ title: 'Access revoked' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const sendLinkMutation = useMutation({
    mutationFn: async (grantId: string) => {
      const response = await fetch(`/internal/x9k7m2p4/docs-access/${grantId}/send-link`, {
        method: 'POST',
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to send link' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Login link sent', description: 'The user will receive an email with access instructions.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const grants: DocAccessGrant[] = grantsData?.grants || [];
  const activeGrants = grants.filter(g => g.isActive);
  const revokedGrants = grants.filter(g => !g.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Grant Docs Access</CardTitle>
          <CardDescription>
            Give someone access to the internal developer documentation without admin privileges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && newEmail && grantMutation.mutate(newEmail)}
              data-testid="input-docs-access-email"
            />
            <Button
              onClick={() => grantMutation.mutate(newEmail)}
              disabled={!newEmail || grantMutation.isPending}
              data-testid="button-grant-docs-access"
            >
              <Plus className="w-4 h-4 mr-2" />
              Grant Access
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Access ({activeGrants.length})</CardTitle>
          <CardDescription>
            Users who can currently access the developer documentation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : activeGrants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active grants</p>
          ) : (
            <div className="space-y-3">
              {activeGrants.map((grant) => (
                <div key={grant.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{grant.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Granted: {new Date(grant.grantedAt).toLocaleDateString()}
                      {grant.lastLoginAt && ` • Last login: ${new Date(grant.lastLoginAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendLinkMutation.mutate(grant.id)}
                      disabled={sendLinkMutation.isPending}
                      data-testid={`button-send-link-${grant.id}`}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Send Link
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeMutation.mutate(grant.id)}
                      disabled={revokeMutation.isPending}
                      data-testid={`button-revoke-${grant.id}`}
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {revokedGrants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revoked Access ({revokedGrants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {revokedGrants.map((grant) => (
                <div key={grant.id} className="flex items-center justify-between p-2 border rounded-lg opacity-60">
                  <div>
                    <p className="font-medium line-through">{grant.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Revoked: {grant.revokedAt && new Date(grant.revokedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CSVImportTab({ authHeader }: { authHeader: string }) {
  const { toast } = useToast();
  const [csvContent, setCsvContent] = useState('');
  const [defaultGroupId, setDefaultGroupId] = useState<string>('');
  const [defaultTier, setDefaultTier] = useState<string>('free');
  const [isDragging, setIsDragging] = useState(false);

  const { data: groupsData } = useQuery({
    queryKey: ['/internal/groups'],
    queryFn: async () => {
      const response = await fetch('/internal/groups', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: { csvContent: string; defaultGroupId?: string; defaultTier: string }) => {
      const response = await fetch('/internal/users/import-csv', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to import CSV' }));
        throw new Error(err.error);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/internal/users'] });
      toast({
        title: 'Import Complete',
        description: `Created: ${data.created}, Updated: ${data.updated}, Errors: ${data.errors?.length || 0}`,
      });
      if (data.errors?.length > 0) {
        console.log('Import errors:', data.errors);
      }
      setCsvContent('');
    },
    onError: (error: any) => {
      toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      toast({ title: 'Invalid File', description: 'Please upload a CSV file', variant: 'destructive' });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const downloadTemplate = () => {
    window.open('/internal/users/csv-template', '_blank');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                CSV Import
              </CardTitle>
              <CardDescription>
                Bulk import users from a CSV file
              </CardDescription>
            </div>
            <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Drag & drop a CSV file here</p>
            <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-file-input"
            />
            <Button variant="outline" onClick={() => document.getElementById('csv-file-input')?.click()} data-testid="button-browse-csv">
              Browse Files
            </Button>
          </div>

          {csvContent && (
            <>
              <div className="space-y-2">
                <Label>CSV Content Preview</Label>
                <Textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="textarea-csv-content"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Group</Label>
                  <Select value={defaultGroupId} onValueChange={setDefaultGroupId}>
                    <SelectTrigger data-testid="select-default-group">
                      <SelectValue placeholder="No default group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default group</SelectItem>
                      {groupsData?.groups?.map((group: UserGroup) => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Subscription Tier</Label>
                  <Select value={defaultTier} onValueChange={setDefaultTier}>
                    <SelectTrigger data-testid="select-default-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <SelectItem key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={() => importMutation.mutate({
                  csvContent,
                  defaultGroupId: defaultGroupId && defaultGroupId !== 'none' ? defaultGroupId : undefined,
                  defaultTier,
                })}
                disabled={importMutation.isPending}
                className="w-full"
                data-testid="button-import-csv"
              >
                {importMutation.isPending ? 'Importing...' : 'Import Users'}
              </Button>
            </>
          )}

          <div className="p-4 bg-accent/20 rounded-lg">
            <h4 className="font-medium mb-2">CSV Format</h4>
            <p className="text-sm text-muted-foreground mb-2">Required columns: <code>email</code></p>
            <p className="text-sm text-muted-foreground">Optional columns: <code>firstName</code>, <code>lastName</code>, <code>subscriptionTier</code>, <code>groupIds</code> (comma-separated)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface FeatureFlag {
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string | null;
  defaultEnabled: boolean | null;
}

interface FeatureGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isDefault: boolean | null;
}

interface FeatureGroupFlag {
  id: string;
  groupId: string;
  flagKey: string;
  enabled: boolean;
}

interface FeatureGroupMembership {
  id: string;
  groupId: string;
  userId: string;
}

interface GroupMember {
  membership: FeatureGroupMembership;
  user: { id: string; email: string | null; firstName: string | null; lastName: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  disabled: 'bg-gray-500',
  beta: 'bg-yellow-500',
  ga: 'bg-green-500',
  deprecated: 'bg-red-500',
};

const CATEGORY_ICONS: Record<string, string> = {
  ai: '🤖',
  canvas: '🎨',
  chat: '💬',
  enterprise: '🏢',
  integrations: '🔌',
};

function FeatureFlagsTab({ authHeader }: { authHeader: string }) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('flags');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [createFlagDialogOpen, setCreateFlagDialogOpen] = useState(false);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFlag, setNewFlag] = useState({ key: '', name: '', description: '', category: 'ai', status: 'disabled', defaultEnabled: false });
  const [newGroup, setNewGroup] = useState({ name: '', description: '', color: '#6366f1' });

  const authHeaders = { 'Authorization': authHeader };

  const { data: flags = [], isLoading: flagsLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/admin/feature-flags'],
    queryFn: async () => {
      const response = await fetch('/api/admin/feature-flags', { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch flags');
      return response.json();
    },
  });

  const { data: groups = [] } = useQuery<FeatureGroup[]>({
    queryKey: ['/api/admin/feature-groups'],
    queryFn: async () => {
      const response = await fetch('/api/admin/feature-groups', { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
  });

  const { data: groupFlags = [] } = useQuery<FeatureGroupFlag[]>({
    queryKey: ['/api/admin/feature-groups', selectedGroup, 'flags'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/feature-groups/${selectedGroup}/flags`, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch group flags');
      return response.json();
    },
    enabled: !!selectedGroup,
  });

  const { data: groupMembers = [] } = useQuery<GroupMember[]>({
    queryKey: ['/api/admin/feature-groups', selectedGroup, 'members'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/feature-groups/${selectedGroup}/members`, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch group members');
      return response.json();
    },
    enabled: !!selectedGroup,
  });

  const { data: allUsers = [] } = useQuery<{ id: string; email: string | null; firstName: string | null; lastName: string | null }[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const createFlagMutation = useMutation({
    mutationFn: async (data: typeof newFlag) => {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create flag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] });
      setCreateFlagDialogOpen(false);
      setNewFlag({ key: '', name: '', description: '', category: 'ai', status: 'disabled', defaultEnabled: false });
      toast({ title: 'Flag created successfully' });
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: Partial<FeatureFlag> }) => {
      const response = await fetch(`/api/admin/feature-flags/${key}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update flag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] });
      toast({ title: 'Flag updated' });
    },
  });

  const deleteFlagMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await fetch(`/api/admin/feature-flags/${key}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to delete flag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] });
      toast({ title: 'Flag deleted' });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: typeof newGroup) => {
      const response = await fetch('/api/admin/feature-groups', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-groups'] });
      setCreateGroupDialogOpen(false);
      setNewGroup({ name: '', description: '', color: '#6366f1' });
      toast({ title: 'Group created successfully' });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/feature-groups/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to delete group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-groups'] });
      setSelectedGroup(null);
      toast({ title: 'Group deleted' });
    },
  });

  const assignFlagMutation = useMutation({
    mutationFn: async ({ groupId, flagKey, enabled }: { groupId: string; flagKey: string; enabled: boolean }) => {
      const response = await fetch(`/api/admin/feature-groups/${groupId}/flags`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey, enabled }),
      });
      if (!response.ok) throw new Error('Failed to assign flag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-groups', selectedGroup, 'flags'] });
      toast({ title: 'Flag assigned to group' });
    },
  });

  const removeFlagMutation = useMutation({
    mutationFn: async ({ groupId, flagKey }: { groupId: string; flagKey: string }) => {
      const response = await fetch(`/api/admin/feature-groups/${groupId}/flags/${flagKey}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to remove flag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-groups', selectedGroup, 'flags'] });
      toast({ title: 'Flag removed from group' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const response = await fetch(`/api/admin/feature-groups/${groupId}/members`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error('Failed to add member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-groups', selectedGroup, 'members'] });
      setAddMemberDialogOpen(false);
      toast({ title: 'Member added to group' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const response = await fetch(`/api/admin/feature-groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to remove member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-groups', selectedGroup, 'members'] });
      toast({ title: 'Member removed from group' });
    },
  });

  const batchMembersMutation = useMutation({
    mutationFn: async ({ groupId, action }: { groupId: string; action: 'add' | 'remove' }) => {
      const response = await fetch(`/api/admin/feature-groups/${groupId}/members/all`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error('Failed to batch update members');
      return response.json();
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-groups', selectedGroup, 'members'] });
      toast({ title: action === 'add' ? 'All users added to group' : 'All users removed from group' });
    },
  });

  const groupedFlags = flags.reduce((acc, flag) => {
    const category = flag.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  const filteredUsers = allUsers.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query)
    );
  });

  const memberIds = new Set(groupMembers.map(m => m.user.id));
  const nonMembers = filteredUsers.filter(u => !memberIds.has(u.id));

  if (flagsLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading feature flags...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="flags" className="flex items-center gap-2" data-testid="tab-ff-flags">
            <Settings className="w-4 h-4" /> Flags ({flags.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2" data-testid="tab-ff-groups">
            <Users className="w-4 h-4" /> Feature Groups ({groups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags">
          <div className="flex justify-between items-center mb-4">
            <p className="text-muted-foreground">{flags.length} feature flags</p>
            <Button onClick={() => setCreateFlagDialogOpen(true)} data-testid="button-create-flag">
              <Plus className="w-4 h-4 mr-2" /> New Flag
            </Button>
          </div>

          {Object.entries(groupedFlags).map(([category, categoryFlags]) => (
            <Card key={category} className="mb-4">
              <CardHeader className="py-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {CATEGORY_ICONS[category] || '📦'} {category.charAt(0).toUpperCase() + category.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {categoryFlags.map(flag => (
                    <div key={flag.key} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors" data-testid={`flag-row-${flag.key}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{flag.key}</code>
                          <Badge className={STATUS_COLORS[flag.status || 'disabled']}>{flag.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{flag.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`default-${flag.key}`} className="text-xs text-muted-foreground">Default</Label>
                          <Switch
                            id={`default-${flag.key}`}
                            checked={flag.defaultEnabled ?? false}
                            onCheckedChange={(checked) => updateFlagMutation.mutate({ key: flag.key, data: { defaultEnabled: checked } })}
                            data-testid={`switch-default-${flag.key}`}
                          />
                        </div>
                        <Select
                          value={flag.status || 'disabled'}
                          onValueChange={(value) => updateFlagMutation.mutate({ key: flag.key, data: { status: value } })}
                        >
                          <SelectTrigger className="w-28" data-testid={`select-status-${flag.key}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disabled">Disabled</SelectItem>
                            <SelectItem value="beta">Beta</SelectItem>
                            <SelectItem value="ga">GA</SelectItem>
                            <SelectItem value="deprecated">Deprecated</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFlagMutation.mutate(flag.key)}
                          data-testid={`button-delete-flag-${flag.key}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="groups">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Feature Groups</CardTitle>
                <Button size="sm" onClick={() => setCreateGroupDialogOpen(true)} data-testid="button-create-ff-group">
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroup(group.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedGroup === group.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/40'}`}
                      data-testid={`button-ff-group-${group.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color || '#6366f1' }} />
                        <span className="font-medium">{group.name}</span>
                        {group.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                      </div>
                      {group.description && <p className="text-xs text-muted-foreground mt-1 truncate">{group.description}</p>}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              {selectedGroup ? (
                <>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{groups.find(g => g.id === selectedGroup)?.name}</CardTitle>
                        <CardDescription>{groups.find(g => g.id === selectedGroup)?.description}</CardDescription>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteGroupMutation.mutate(selectedGroup)} data-testid="button-delete-ff-group">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="members">
                      <TabsList className="mb-4">
                        <TabsTrigger value="members">Members ({groupMembers.length})</TabsTrigger>
                        <TabsTrigger value="assigned-flags">Flags ({groupFlags.length})</TabsTrigger>
                      </TabsList>

                      <TabsContent value="members">
                        <div className="flex gap-2 mb-4">
                          <Button size="sm" onClick={() => setAddMemberDialogOpen(true)} data-testid="button-add-ff-member">
                            <UserPlus className="w-4 h-4 mr-2" /> Add Member
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => batchMembersMutation.mutate({ groupId: selectedGroup, action: 'add' })} data-testid="button-add-all-ff-members">
                            Add All Users
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => batchMembersMutation.mutate({ groupId: selectedGroup, action: 'remove' })} data-testid="button-remove-all-ff-members">
                            Remove All
                          </Button>
                        </div>
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {groupMembers.map(({ membership, user }) => (
                              <div key={membership.id} className="flex items-center justify-between p-2 rounded border" data-testid={`ff-member-row-${user.id}`}>
                                <div>
                                  <p className="font-medium">{user.email || 'No email'}</p>
                                  <p className="text-xs text-muted-foreground">{user.firstName} {user.lastName}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeMemberMutation.mutate({ groupId: selectedGroup, userId: user.id })} data-testid={`button-remove-ff-member-${user.id}`}>
                                  <UserX className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="assigned-flags">
                        <div className="space-y-2">
                          {flags.map(flag => {
                            const assigned = groupFlags.find(gf => gf.flagKey === flag.key);
                            return (
                              <div key={flag.key} className="flex items-center justify-between p-2 rounded border" data-testid={`assign-flag-row-${flag.key}`}>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-mono">{flag.key}</code>
                                  {assigned && <Badge variant={assigned.enabled ? 'default' : 'secondary'}>{assigned.enabled ? 'Enabled' : 'Disabled'}</Badge>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {assigned ? (
                                    <>
                                      <Switch
                                        checked={assigned.enabled}
                                        onCheckedChange={(enabled) => assignFlagMutation.mutate({ groupId: selectedGroup, flagKey: flag.key, enabled })}
                                      />
                                      <Button variant="ghost" size="icon" onClick={() => removeFlagMutation.mutate({ groupId: selectedGroup, flagKey: flag.key })}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => assignFlagMutation.mutate({ groupId: selectedGroup, flagKey: flag.key, enabled: true })}>
                                      <Plus className="w-4 h-4 mr-1" /> Assign
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                  Select a group to manage
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={createFlagDialogOpen} onOpenChange={setCreateFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
            <DialogDescription>Add a new feature flag to control access to features.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Key</Label>
              <Input placeholder="e.g., ai.newFeature" value={newFlag.key} onChange={e => setNewFlag({ ...newFlag, key: e.target.value })} data-testid="input-flag-key" />
            </div>
            <div>
              <Label>Name</Label>
              <Input placeholder="Human-readable name" value={newFlag.name} onChange={e => setNewFlag({ ...newFlag, name: e.target.value })} data-testid="input-flag-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Description" value={newFlag.description} onChange={e => setNewFlag({ ...newFlag, description: e.target.value })} data-testid="input-flag-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={newFlag.category} onValueChange={value => setNewFlag({ ...newFlag, category: value })}>
                  <SelectTrigger data-testid="select-flag-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">AI</SelectItem>
                    <SelectItem value="canvas">Canvas</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="integrations">Integrations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={newFlag.status} onValueChange={value => setNewFlag({ ...newFlag, status: value })}>
                  <SelectTrigger data-testid="select-flag-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="beta">Beta</SelectItem>
                    <SelectItem value="ga">GA</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newFlag.defaultEnabled} onCheckedChange={checked => setNewFlag({ ...newFlag, defaultEnabled: checked })} data-testid="switch-flag-default" />
              <Label>Default Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFlagDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createFlagMutation.mutate(newFlag)} disabled={!newFlag.key || !newFlag.name} data-testid="button-submit-flag">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createGroupDialogOpen} onOpenChange={setCreateGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Group</DialogTitle>
            <DialogDescription>Groups let you control which users have access to specific features.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input placeholder="e.g., Beta Testers" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} data-testid="input-ff-group-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Description" value={newGroup.description} onChange={e => setNewGroup({ ...newGroup, description: e.target.value })} data-testid="input-ff-group-description" />
            </div>
            <div>
              <Label>Color</Label>
              <Input type="color" value={newGroup.color} onChange={e => setNewGroup({ ...newGroup, color: e.target.value })} className="w-16 h-10" data-testid="input-ff-group-color" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createGroupMutation.mutate(newGroup)} disabled={!newGroup.name} data-testid="button-submit-ff-group">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Group</DialogTitle>
            <DialogDescription>Search and add users to this group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by email or name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-ff-users" />
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {nonMembers.slice(0, 20).map(user => (
                  <button
                    key={user.id}
                    onClick={() => addMemberMutation.mutate({ groupId: selectedGroup!, userId: user.id })}
                    className="w-full text-left p-2 rounded border hover:bg-muted/40 transition-colors"
                    data-testid={`button-add-ff-user-${user.id}`}
                  >
                    <p className="font-medium">{user.email || 'No email'}</p>
                    <p className="text-xs text-muted-foreground">{user.firstName} {user.lastName}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCodes() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authHeader, setAuthHeader] = useState('');
  const [grantsUnlimited, setGrantsUnlimited] = useState(false);
  const [creditsToAdd, setCreditsToAdd] = useState(25);
  const [allowedCountries, setAllowedCountries] = useState<string[]>(['US']);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  // Restore auth from sessionStorage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem('adminToken');
    if (savedToken) {
      const header = `Bearer ${savedToken}`;
      setAuthHeader(header);
      setIsAuthenticated(true);
    }
  }, []);
  
  // Handle auth errors (session expired)
  const handleAuthError = () => {
    sessionStorage.removeItem('adminToken');
    setAuthHeader('');
    setIsAuthenticated(false);
    toast({
      title: 'Session Expired',
      description: 'Please login again',
      variant: 'destructive',
    });
  };

  const { data: codesData, isLoading } = useQuery({
    queryKey: ['/internal/ops-codes/list'],
    queryFn: async () => {
      const response = await fetch('/internal/ops-codes/list', {
        headers: {
          'Authorization': authHeader,
        },
      });
      if (response.status === 401) {
        handleAuthError();
        throw new Error('Session expired');
      }
      if (!response.ok) throw new Error('Failed to fetch codes');
      return response.json();
    },
    enabled: isAuthenticated && !!authHeader,
  });

  const generateCodeMutation = useMutation({
    mutationFn: async (data: { grantsUnlimited: boolean; creditsToAdd: number; allowedCountries: string[]; notes: string }) => {
      const response = await fetch('/internal/ops-codes/generate', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate code' }));
        throw new Error(errorData.error || 'Failed to generate code');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/internal/ops-codes/list'] });
      toast({
        title: 'Code Generated',
        description: `Code: ${data.code.code}`,
      });
      setNotes('');
      setGrantsUnlimited(false);
      setCreditsToAdd(10);
      setAllowedCountries(['US']);
      
      navigator.clipboard.writeText(data.code.code);
      toast({
        title: 'Copied to clipboard',
        description: `Code ${data.code.code} copied to clipboard`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate code',
        variant: 'destructive',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (data: { codeId: string; revoke: boolean }) => {
      const response = await fetch(`/internal/ops-codes/revoke/${data.codeId}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ revoke: data.revoke }),
      });
      if (!response.ok) throw new Error('Failed to update code');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/internal/ops-codes/list'] });
      toast({
        title: 'Success',
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update code',
        variant: 'destructive',
      });
    },
  });

  const handleLogin = async () => {
    try {
      const loginResponse = await fetch('/internal/x9k7m2p4/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (loginResponse.ok) {
        const data = await loginResponse.json();
        const header = `Bearer ${data.token}`;
        setAuthHeader(header);
        setIsAuthenticated(true);
        // Save token to sessionStorage for cross-page access
        sessionStorage.setItem('adminToken', data.token);
        
        if (data.expiresIn) {
          setTimeout(() => {
            toast({
              title: 'Session Expiring',
              description: 'Your admin session will expire soon. Please re-login.',
              variant: 'destructive',
            });
          }, (data.expiresIn - 300) * 1000);
        }
        
        toast({
          title: 'Login Successful',
          description: 'Welcome to admin panel',
        });
      } else {
        let errorMessage = 'Invalid username or password';
        try {
          const contentType = loginResponse.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await loginResponse.json();
            errorMessage = errorData.error || errorMessage;
          } else if (loginResponse.status === 429) {
            errorMessage = 'Too many login attempts. Please try again later.';
          }
        } catch {
          // Use default error message if parsing fails
        }
        toast({
          title: 'Login Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: 'Unable to connect to server',
        variant: 'destructive',
      });
    }
  };

  const handleGenerate = () => {
    generateCodeMutation.mutate({
      grantsUnlimited,
      creditsToAdd,
      allowedCountries,
      notes: notes.trim() || '',
    });
  };

  const toggleCountry = (countryCode: string) => {
    setAllowedCountries(prev => 
      prev.includes(countryCode)
        ? prev.filter(c => c !== countryCode)
        : [...prev, countryCode]
    );
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Copied',
      description: `Code ${code} copied to clipboard`,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Admin Authentication
            </CardTitle>
            <CardDescription>
              Enter admin credentials to access code management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                data-testid="input-admin-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                data-testid="input-admin-password"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              className="w-full"
              disabled={!username || !password}
              data-testid="button-admin-login"
            >
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Admin Panel
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/internal/docs">
              <Button variant="outline" data-testid="button-dev-docs">
                Developer Docs
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await fetch('/internal/x9k7m2p4/logout', {
                    method: 'POST',
                    headers: { 'Authorization': authHeader },
                  });
                } catch {
                  // Continue with logout even if server request fails
                }
                setIsAuthenticated(false);
                setAuthHeader('');
              }}
              data-testid="button-logout"
            >
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="waitlist" className="w-full">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="waitlist" data-testid="tab-waitlist-management">
              <ClipboardList className="w-4 h-4 mr-2" />
              Waitlist
            </TabsTrigger>
            <TabsTrigger value="codes" data-testid="tab-codes-management">
              <Key className="w-4 h-4 mr-2" />
              Codes
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users-management">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="beta" data-testid="tab-beta-users">
              <Star className="w-4 h-4 mr-2 text-yellow-500" />
              Beta
            </TabsTrigger>
            <TabsTrigger value="groups" data-testid="tab-groups-management">
              <FolderTree className="w-4 h-4 mr-2" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="flags" data-testid="tab-feature-flags">
              <Flag className="w-4 h-4 mr-2" />
              Flags
            </TabsTrigger>
            <TabsTrigger value="docs-access" data-testid="tab-docs-access">
              <FileText className="w-4 h-4 mr-2" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="import" data-testid="tab-csv-import">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="waitlist" className="mt-6">
            <WaitlistTab authHeader={authHeader} />
          </TabsContent>

          <TabsContent value="codes" className="space-y-6 mt-6">
            <Card>
          <CardHeader>
            <CardTitle>Generate New Code</CardTitle>
            <CardDescription>
              Create a new unlock code for users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="unlimited"
                checked={grantsUnlimited}
                onCheckedChange={(checked) => setGrantsUnlimited(checked as boolean)}
                data-testid="checkbox-unlimited"
              />
              <Label htmlFor="unlimited" className="cursor-pointer">
                Grant Unlimited Credits (for trusted users)
              </Label>
            </div>

            {!grantsUnlimited && (
              <div className="space-y-2">
                <Label htmlFor="credits">Credits to Grant</Label>
                <Input
                  id="credits"
                  type="number"
                  min="1"
                  max="1000"
                  value={creditsToAdd}
                  onChange={(e) => setCreditsToAdd(parseInt(e.target.value) || 10)}
                  data-testid="input-credits-amount"
                />
                <p className="text-sm text-muted-foreground">
                  Number of AI operation credits to grant (default: 10)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Allowed Countries</Label>
              <div className="grid grid-cols-2 gap-2 p-4 border rounded-md max-h-48 overflow-y-auto">
                {AVAILABLE_COUNTRIES.map((country) => (
                  <div key={country.code} className="flex items-center space-x-2">
                    <Checkbox
                      id={`country-${country.code}`}
                      checked={allowedCountries.includes(country.code)}
                      onCheckedChange={() => toggleCountry(country.code)}
                      data-testid={`checkbox-country-${country.code}`}
                    />
                    <Label 
                      htmlFor={`country-${country.code}`} 
                      className="cursor-pointer text-sm font-normal"
                    >
                      {country.name}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Select countries where this code can be used (default: US only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., For VIP user John Doe"
                data-testid="input-code-notes"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateCodeMutation.isPending || allowedCountries.length === 0 || (!grantsUnlimited && creditsToAdd < 1)}
              data-testid="button-generate-code"
            >
              {generateCodeMutation.isPending ? 'Generating...' : 'Generate Code'}
            </Button>
            {allowedCountries.length === 0 && (
              <p className="text-sm text-destructive">
                Please select at least one country
              </p>
            )}
            {!grantsUnlimited && creditsToAdd < 1 && (
              <p className="text-sm text-destructive">
                Credits must be at least 1
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Unlock Codes</CardTitle>
            <CardDescription>
              {codesData?.codes?.length || 0} codes generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-2">
                {codesData?.codes?.map((code: UnlockCode) => (
                  <div
                    key={code.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`code-item-${code.id}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-lg">
                          {code.code}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyCode(code.code)}
                          data-testid={`button-copy-${code.id}`}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {code.grantsUnlimited ? (
                          <Badge variant="default" data-testid={`badge-unlimited-${code.id}`}>
                            Unlimited Credits
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-credits-${code.id}`}>
                            {code.creditsToAdd} Credits
                          </Badge>
                        )}
                        <Badge variant="outline" data-testid={`badge-countries-${code.id}`}>
                          {code.allowedCountries?.join(', ') || 'US'}
                        </Badge>
                        {code.isRevoked ? (
                          <Badge variant="destructive" data-testid={`badge-revoked-${code.id}`}>
                            Revoked
                          </Badge>
                        ) : code.isUsed ? (
                          <Badge variant="destructive" data-testid={`badge-used-${code.id}`}>
                            Used by {code.usedBy}
                          </Badge>
                        ) : (
                          <Badge variant="outline" data-testid={`badge-available-${code.id}`}>
                            Available
                          </Badge>
                        )}
                      </div>
                      {code.notes && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-notes-${code.id}`}>
                          {code.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground" data-testid={`text-created-${code.id}`}>
                        Created: {new Date(code.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {code.isRevoked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeMutation.mutate({ codeId: code.id, revoke: false })}
                          disabled={revokeMutation.isPending}
                          data-testid={`button-restore-${code.id}`}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeMutation.mutate({ codeId: code.id, revoke: true })}
                          disabled={revokeMutation.isPending}
                          data-testid={`button-revoke-${code.id}`}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UsersTab authHeader={authHeader} />
          </TabsContent>

          <TabsContent value="beta" className="mt-6">
            <BetaUsersTab authHeader={authHeader} />
          </TabsContent>

          <TabsContent value="groups" className="mt-6">
            <GroupsTab authHeader={authHeader} />
          </TabsContent>

          <TabsContent value="flags" className="mt-6">
            <FeatureFlagsTab authHeader={authHeader} />
          </TabsContent>

          <TabsContent value="docs-access" className="mt-6">
            <DocsAccessTab authHeader={authHeader} />
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <CSVImportTab authHeader={authHeader} />
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalytics authHeader={authHeader} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
