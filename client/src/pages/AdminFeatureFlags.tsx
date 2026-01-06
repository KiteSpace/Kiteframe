import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Flag, Users, Settings, Plus, Trash2, UserPlus, UserMinus, Search, ArrowLeft } from 'lucide-react';
import type { FeatureFlag, FeatureGroup, FeatureGroupFlag, FeatureGroupMembership } from '@shared/schema';

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

export default function AdminFeatureFlags() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('flags');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [createFlagDialogOpen, setCreateFlagDialogOpen] = useState(false);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [newFlag, setNewFlag] = useState({ key: '', name: '', description: '', category: 'ai', status: 'disabled', defaultEnabled: false });
  const [newGroup, setNewGroup] = useState({ name: '', description: '', color: '#6366f1' });

  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
      navigate('/internal/x9k7m2p4');
    } else {
      setAdminToken(token);
    }
    setAuthChecked(true);
  }, [navigate]);

  const authHeader = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};

  const handleAuthError = () => {
    sessionStorage.removeItem('adminToken');
    setAdminToken(null);
    navigate('/internal/x9k7m2p4');
  };

  const { data: flags = [], isLoading: flagsLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/admin/feature-flags'],
    queryFn: async () => {
      const response = await fetch('/api/admin/feature-flags', { headers: authHeader });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
      if (!response.ok) throw new Error('Failed to fetch flags');
      return response.json();
    },
    enabled: !!adminToken && authChecked,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery<FeatureGroup[]>({
    queryKey: ['/api/admin/feature-groups'],
    queryFn: async () => {
      const response = await fetch('/api/admin/feature-groups', { headers: authHeader });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
    enabled: !!adminToken && authChecked,
  });

  const { data: groupFlags = [] } = useQuery<FeatureGroupFlag[]>({
    queryKey: ['/api/admin/feature-groups', selectedGroup, 'flags'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/feature-groups/${selectedGroup}/flags`, { headers: authHeader });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
      if (!response.ok) throw new Error('Failed to fetch group flags');
      return response.json();
    },
    enabled: !!selectedGroup && !!adminToken && authChecked,
  });

  const { data: groupMembers = [] } = useQuery<GroupMember[]>({
    queryKey: ['/api/admin/feature-groups', selectedGroup, 'members'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/feature-groups/${selectedGroup}/members`, { headers: authHeader });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
      if (!response.ok) throw new Error('Failed to fetch group members');
      return response.json();
    },
    enabled: !!selectedGroup && !!adminToken && authChecked,
  });

  const { data: allUsers = [] } = useQuery<{ id: string; email: string | null; firstName: string | null; lastName: string | null }[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', { headers: authHeader });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: !!adminToken && authChecked,
  });

  const createFlagMutation = useMutation({
    mutationFn: async (data: typeof newFlag) => {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: authHeader,
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: authHeader,
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey, enabled }),
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: authHeader,
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: authHeader,
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (response.status === 401) { handleAuthError(); throw new Error('Session expired'); }
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

  if (!authChecked || !adminToken) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (flagsLoading || groupsLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/internal/x9k7m2p4')} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Flag className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Feature Flags</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="flags" className="flex items-center gap-2" data-testid="tab-flags">
            <Settings className="w-4 h-4" /> Flags
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2" data-testid="tab-groups">
            <Users className="w-4 h-4" /> Groups
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
                <CardTitle>Groups</CardTitle>
                <Button size="sm" onClick={() => setCreateGroupDialogOpen(true)} data-testid="button-create-group">
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
                      data-testid={`button-group-${group.id}`}
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
                      <Button variant="destructive" size="sm" onClick={() => deleteGroupMutation.mutate(selectedGroup)} data-testid="button-delete-group">
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
                          <Button size="sm" onClick={() => setAddMemberDialogOpen(true)} data-testid="button-add-member">
                            <UserPlus className="w-4 h-4 mr-2" /> Add Member
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => batchMembersMutation.mutate({ groupId: selectedGroup, action: 'add' })} data-testid="button-add-all-members">
                            Add All Users
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => batchMembersMutation.mutate({ groupId: selectedGroup, action: 'remove' })} data-testid="button-remove-all-members">
                            Remove All
                          </Button>
                        </div>
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {groupMembers.map(({ membership, user }) => (
                              <div key={membership.id} className="flex items-center justify-between p-2 rounded border" data-testid={`member-row-${user.id}`}>
                                <div>
                                  <p className="font-medium">{user.email || 'No email'}</p>
                                  <p className="text-xs text-muted-foreground">{user.firstName} {user.lastName}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeMemberMutation.mutate({ groupId: selectedGroup, userId: user.id })} data-testid={`button-remove-member-${user.id}`}>
                                  <UserMinus className="w-4 h-4 text-destructive" />
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
              <Input placeholder="e.g., Beta Testers" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} data-testid="input-group-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Description" value={newGroup.description} onChange={e => setNewGroup({ ...newGroup, description: e.target.value })} data-testid="input-group-description" />
            </div>
            <div>
              <Label>Color</Label>
              <Input type="color" value={newGroup.color} onChange={e => setNewGroup({ ...newGroup, color: e.target.value })} className="w-16 h-10" data-testid="input-group-color" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createGroupMutation.mutate(newGroup)} disabled={!newGroup.name} data-testid="button-submit-group">Create</Button>
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
              <Input placeholder="Search by email or name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-users" />
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {nonMembers.slice(0, 20).map(user => (
                  <button
                    key={user.id}
                    onClick={() => addMemberMutation.mutate({ groupId: selectedGroup!, userId: user.id })}
                    className="w-full text-left p-2 rounded border hover:bg-muted/40 transition-colors"
                    data-testid={`button-add-user-${user.id}`}
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
