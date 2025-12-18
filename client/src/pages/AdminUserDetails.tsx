import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useRoute, Link } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Trash2, Save, Activity, BarChart3, Clock, Shield, LogIn } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const SUBSCRIPTION_TIERS = ['free', 'advanced', 'pro'] as const;

const FEATURE_COLORS: Record<string, string> = {
  chat: "#3b82f6",
  workflow_generation: "#22c55e",
  prd_generation: "#f59e0b",
  vision_analysis: "#8b5cf6",
  image_upload: "#ec4899",
  project_summary: "#14b8a6",
};

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
}

export default function AdminUserDetails() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute('/internal/x9k7m2p4/users/:userId');
  const userId = params?.userId;
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editTier, setEditTier] = useState<string>('free');
  const [editCredits, setEditCredits] = useState<number>(0);
  const [editUnlimited, setEditUnlimited] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
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

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/internal/users', userId],
    queryFn: async () => {
      const response = await fetch(`/internal/users/${userId}`, {
        headers: { 'Authorization': authHeader },
      });
      if (response.status === 401) {
        handleAuthError();
        throw new Error('Session expired');
      }
      if (!response.ok) throw new Error('Failed to fetch user');
      const data = await response.json();
      setEditTier(data.user?.subscriptionTier || 'free');
      setEditCredits(data.user?.credits?.credits || 0);
      setEditUnlimited(data.user?.credits?.isUnlimited || false);
      setSelectedGroups(data.user?.groups?.map((g: any) => g.groupId) || []);
      return data;
    },
    enabled: !!userId && !!adminToken && authChecked,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['/internal/users', userId, 'activity'],
    queryFn: async () => {
      const response = await fetch(`/internal/users/${userId}/activity`, {
        headers: { 'Authorization': authHeader },
      });
      if (response.status === 401) {
        handleAuthError();
        throw new Error('Session expired');
      }
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    },
    enabled: !!userId && !!adminToken && authChecked,
  });

  const { data: groupsData } = useQuery({
    queryKey: ['/internal/groups'],
    queryFn: async () => {
      const response = await fetch('/internal/groups', {
        headers: { 'Authorization': authHeader },
      });
      if (response.status === 401) {
        handleAuthError();
        throw new Error('Session expired');
      }
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
    enabled: !!adminToken && authChecked,
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/internal/users/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionTier: editTier }),
      });
      await fetch(`/internal/users/${userId}/credits`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: editCredits, isUnlimited: editUnlimited }),
      });
      await fetch(`/internal/users/${userId}/groups`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: selectedGroups }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/internal/users', userId] });
      toast({ title: 'User Updated', description: 'All changes saved successfully' });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/internal/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to delete user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User Deleted', description: 'User has been permanently deleted' });
      navigate('/internal/x9k7m2p4');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
    setHasUnsavedChanges(true);
  };

  const user = userData?.user;
  const activity = activityData?.activity;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const featureChartData = activity?.featureBreakdown
    ? Object.entries(activity.featureBreakdown).map(([name, value]) => ({ name, value, fill: FEATURE_COLORS[name] || '#888' }))
    : [];

  if (!userId) {
    return <div className="p-8">User ID not found</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/internal/x9k7m2p4')} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="w-6 h-6" />
              User Details
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">Unsaved Changes</Badge>
            )}
            <Button
              onClick={() => updateUserMutation.mutate()}
              disabled={updateUserMutation.isPending || !hasUnsavedChanges}
              data-testid="button-save-user"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} data-testid="button-delete-user">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete User
            </Button>
          </div>
        </div>

        {userLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px] md:col-span-2" />
          </div>
        ) : user ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  User Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-medium">{user.email || 'No email'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">First Name</Label>
                    <p>{user.firstName || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Last Name</Label>
                    <p>{user.lastName || '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created At</Label>
                  <p>{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Beta Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={user.isBeta ? 'default' : 'secondary'}>
                      {user.isBeta ? 'Beta User' : 'Waitlist'}
                    </Badge>
                    {user.betaGrantedAt && (
                      <span className="text-xs text-muted-foreground">since {formatDate(user.betaGrantedAt)}</span>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Subscription Tier</Label>
                  <Select value={editTier} onValueChange={(v) => { setEditTier(v); setHasUnsavedChanges(true); }}>
                    <SelectTrigger data-testid="select-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_TIERS.map(tier => (
                        <SelectItem key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Unlimited Credits</Label>
                    <Switch
                      checked={editUnlimited}
                      onCheckedChange={(v) => { setEditUnlimited(v); setHasUnsavedChanges(true); }}
                      data-testid="switch-unlimited"
                    />
                  </div>
                  {!editUnlimited && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Credits</Label>
                      <Input
                        type="number"
                        min="0"
                        value={editCredits}
                        onChange={(e) => { setEditCredits(parseInt(e.target.value) || 0); setHasUnsavedChanges(true); }}
                        data-testid="input-credits"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Group Memberships</Label>
                  <ScrollArea className="h-32 border rounded-md p-2">
                    {groupsData?.groups?.map((group: UserGroup) => (
                      <div key={group.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={selectedGroups.includes(group.id)}
                          onCheckedChange={() => toggleGroup(group.id)}
                          data-testid={`checkbox-group-${group.id}`}
                        />
                        <Label htmlFor={`group-${group.id}`} className="cursor-pointer text-sm font-normal">
                          {group.name}
                        </Label>
                      </div>
                    ))}
                    {(!groupsData?.groups || groupsData.groups.length === 0) && (
                      <p className="text-sm text-muted-foreground">No groups available</p>
                    )}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Token Usage (Last 30 Days)
                  </CardTitle>
                  <CardDescription>
                    {activityLoading ? 'Loading...' : `${activity?.totalTokens?.toLocaleString() || 0} tokens • ${activity?.totalUnits || 0} units`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activityLoading ? (
                    <Skeleton className="h-[200px]" />
                  ) : activity?.dailyUsage?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={activity.dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="units" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      No usage data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BarChart3 className="w-5 h-5" />
                      Feature Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activityLoading ? (
                      <Skeleton className="h-[150px]" />
                    ) : featureChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={featureChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name }) => name}>
                            {featureChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                        No feature data
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <LogIn className="w-5 h-5" />
                      Login Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activityLoading ? (
                      <Skeleton className="h-[150px]" />
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-muted-foreground text-xs">Last Login</Label>
                          <p>{formatDate(activity?.lastLogin)}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Auth Providers</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {activity?.providers?.map((p: any) => (
                              <Badge key={p.provider} variant="outline">
                                {p.provider}
                              </Badge>
                            )) || <span className="text-muted-foreground">None</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityLoading ? (
                    <Skeleton className="h-[200px]" />
                  ) : activity?.recentEvents?.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {activity.recentEvents.map((event: any) => (
                        <div key={event.id} className="flex items-center justify-between p-2 bg-accent/30 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" style={{ backgroundColor: FEATURE_COLORS[event.feature] + '20', borderColor: FEATURE_COLORS[event.feature] }}>
                              {event.feature}
                            </Badge>
                            <span className="text-muted-foreground">{event.model}</span>
                          </div>
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>{event.tokens?.toLocaleString()} tokens</span>
                            <span>{formatDate(event.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-[100px] flex items-center justify-center text-muted-foreground">
                      No recent activity
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              User not found
            </CardContent>
          </Card>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{user?.email}</strong> and all their data including credits, group memberships, and usage history.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteUserMutation.mutate()}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
