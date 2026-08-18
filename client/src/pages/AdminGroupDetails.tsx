import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useRoute, Link } from 'wouter';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FolderTree, Trash2, Save, Users, Settings, UserMinus } from 'lucide-react';
import { formatDate as sharedFormatDate } from '@/lib/utils/formatDate';

interface GroupAccessControls {
  unlimitedCredits?: boolean;
  subscriptionTierOverride?: 'free' | 'advanced' | 'pro';
  bypassCreditCheck?: boolean;
  monthlyCreditsOverride?: number;
  features?: string[];
}

interface GroupMember {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionTier: string;
  profileImageUrl: string | null;
  addedAt: string | null;
}

export default function AdminGroupDetails() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute('/internal/x9k7m2p4/groups/:groupId');
  const groupId = params?.groupId;
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [accessControls, setAccessControls] = useState<GroupAccessControls>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  
  // Check auth on mount (only once)
  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
      navigate('/internal/x9k7m2p4');
    } else {
      setAdminToken(token);
    }
    setAuthChecked(true);
  }, [navigate]);
  
  const authHeader = adminToken ? `Bearer ${adminToken}` : '';

  const handleAuthError = () => {
    sessionStorage.removeItem('adminToken');
    setAdminToken(null);
    navigate('/internal/x9k7m2p4');
  };

  const { data: groupData, isLoading } = useQuery({
    queryKey: ['/internal/groups', groupId, 'details'],
    queryFn: async () => {
      const response = await fetch(`/internal/groups/${groupId}/details`, {
        headers: { 'Authorization': authHeader },
      });
      if (response.status === 401) {
        handleAuthError();
        throw new Error('Session expired');
      }
      if (!response.ok) throw new Error('Failed to fetch group');
      const data = await response.json();
      setGroupName(data.group?.name || '');
      setGroupDescription(data.group?.description || '');
      setAccessControls(data.group?.accessControls || {});
      return data;
    },
    enabled: !!groupId && !!adminToken && authChecked,
  });

  const updateGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/internal/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, description: groupDescription, accessControls }),
      });
      if (!response.ok) throw new Error('Failed to update group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups', groupId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      toast({ title: 'Group Updated', description: 'All changes saved successfully' });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/internal/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to delete group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups'] });
      toast({ title: 'Group Deleted', description: 'Group has been permanently deleted' });
      navigate('/internal/x9k7m2p4');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/internal/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to remove member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/groups', groupId, 'details'] });
      toast({ title: 'Member Removed', description: 'User has been removed from the group' });
      setRemoveMemberDialogOpen(false);
      setMemberToRemove(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const group = groupData?.group;
  const members: GroupMember[] = group?.members || [];

  const formatDate = (dateStr: string | null) =>
    sharedFormatDate(dateStr);

  if (!groupId) {
    return <div className="p-8">Group ID not found</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/internal/x9k7m2p4')} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderTree className="w-6 h-6" />
              Group Details
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">Unsaved Changes</Badge>
            )}
            <Button
              onClick={() => updateGroupMutation.mutate()}
              disabled={updateGroupMutation.isPending || !hasUnsavedChanges}
              data-testid="button-save-group"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} data-testid="button-delete-group">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Group
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
        ) : group ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Group Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Group Name</Label>
                  <Input
                    value={groupName}
                    onChange={(e) => { setGroupName(e.target.value); setHasUnsavedChanges(true); }}
                    placeholder="e.g., Beta Testers"
                    data-testid="input-group-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={groupDescription}
                    onChange={(e) => { setGroupDescription(e.target.value); setHasUnsavedChanges(true); }}
                    placeholder="Group purpose and notes..."
                    data-testid="input-group-description"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created At</Label>
                  <p>{formatDate(group.createdAt)}</p>
                </div>

                <Separator />

                <div className="space-y-4 p-4 border rounded-lg bg-accent/20">
                  <h4 className="font-medium">Access Controls</h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Unlimited Credits</Label>
                      <p className="text-xs text-muted-foreground">Members have unlimited AI credits</p>
                    </div>
                    <Switch
                      checked={accessControls.unlimitedCredits || false}
                      onCheckedChange={(checked) => { setAccessControls({ ...accessControls, unlimitedCredits: checked }); setHasUnsavedChanges(true); }}
                      data-testid="switch-group-unlimited"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Bypass Credit Check</Label>
                      <p className="text-xs text-muted-foreground">Skip credit verification entirely</p>
                    </div>
                    <Switch
                      checked={accessControls.bypassCreditCheck || false}
                      onCheckedChange={(checked) => { setAccessControls({ ...accessControls, bypassCreditCheck: checked }); setHasUnsavedChanges(true); }}
                      data-testid="switch-group-bypass"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Subscription Tier Override</Label>
                    <Select
                      value={accessControls.subscriptionTierOverride || 'none'}
                      onValueChange={(v) => { setAccessControls({ ...accessControls, subscriptionTierOverride: v === 'none' ? undefined : v as any }); setHasUnsavedChanges(true); }}
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
                      value={accessControls.monthlyCreditsOverride || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : undefined;
                        setAccessControls({ ...accessControls, monthlyCreditsOverride: val });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="input-group-credits-override"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Feature Flags (comma-separated)</Label>
                    <Input
                      placeholder="e.g., beta_features, early_access"
                      value={accessControls.features?.join(', ') || ''}
                      onChange={(e) => {
                        const features = e.target.value ? e.target.value.split(',').map(f => f.trim()).filter(Boolean) : undefined;
                        setAccessControls({ ...accessControls, features });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="input-group-features"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Members ({members.length})
                </CardTitle>
                <CardDescription>
                  Users in this group
                </CardDescription>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No members in this group yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {members.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/30 transition-colors"
                        data-testid={`member-row-${member.userId}`}
                      >
                        <div className="flex items-center gap-3">
                          {member.profileImageUrl ? (
                            <img src={member.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div>
                            <Link
                              href={`/internal/x9k7m2p4/users/${member.userId}`}
                              className="font-medium hover:underline text-primary"
                              data-testid={`link-user-${member.userId}`}
                            >
                              {member.email || 'No email'}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {member.firstName} {member.lastName} • Added {formatDate(member.addedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.subscriptionTier === 'pro' ? 'default' : 'outline'}>
                            {member.subscriptionTier || 'free'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => { setMemberToRemove(member); setRemoveMemberDialogOpen(true); }}
                            data-testid={`button-remove-member-${member.userId}`}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Group not found
            </CardContent>
          </Card>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Group</DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{group?.name}</strong> and remove all member associations.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteGroupMutation.mutate()}
                disabled={deleteGroupMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete Group'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Member</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong>{memberToRemove?.email}</strong> from this group?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRemoveMemberDialogOpen(false); setMemberToRemove(null); }}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => memberToRemove && removeMemberMutation.mutate(memberToRemove.userId)}
                disabled={removeMemberMutation.isPending}
                data-testid="button-confirm-remove-member"
              >
                {removeMemberMutation.isPending ? 'Removing...' : 'Remove Member'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
