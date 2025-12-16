import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  User, 
  CreditCard, 
  LogOut, 
  Trash2, 
  Crown, 
  Sparkles, 
  Zap,
  Loader2,
  ExternalLink,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'wouter';
import kiteframeIcon from "@assets/kiteframe@2x_1758226635607.png";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useReplitAuth } from '@/hooks/useReplitAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { User as UserType } from '@shared/schema';

const tierInfo = {
  free: {
    name: 'Free',
    icon: Zap,
    color: 'bg-slate-100 text-slate-800',
    credits: 25,
  },
  advanced: {
    name: 'Advanced',
    icon: Sparkles,
    color: 'bg-blue-100 text-blue-800',
    credits: 150,
  },
  pro: {
    name: 'Pro',
    icon: Crown,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    credits: 500,
  },
};

export default function Account() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { user: authUser, isLoading: authLoading } = useReplitAuth();
  const { toast } = useToast();

  const { data: userData } = useQuery<UserType>({
    queryKey: ['/api/auth/user'],
    enabled: !!authUser,
  });

  const { data: subscriptionData } = useQuery<{ tier?: string; status?: string; billingPeriodEnd?: string }>({
    queryKey: ['/api/subscription'],
    enabled: !!authUser,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/billing/portal', {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Unable to open billing portal.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/account', {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Account Deleted',
        description: 'Your account has been permanently deleted.',
      });
      window.location.href = '/';
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Unable to delete account. Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>Please sign in to view your account settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/api/login'} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTier = (subscriptionData?.tier || 'free') as keyof typeof tierInfo;
  const tier = tierInfo[currentTier];
  const TierIcon = tier.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      {/* Header with back button and logo */}
      <header className="h-16 px-4 py-2 flex items-center justify-between bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <a className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="link-back-to-app">
              <ArrowLeft className="h-5 w-5" />
              <img src={kiteframeIcon} alt="Kiteframe" className="w-6 h-6" />
              <span className="text-lg font-semibold">Kiteframe</span>
            </a>
          </Link>
        </div>
      </header>

      <div className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">Account Settings</h1>

        <div className="space-y-6">
          {/* Profile Card */}
          <Card data-testid="card-profile">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={userData?.profileImageUrl || ''} />
                  <AvatarFallback>
                    {userData?.firstName?.[0] || userData?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {userData?.firstName && userData?.lastName
                      ? `${userData.firstName} ${userData.lastName}`
                      : userData?.email || 'User'}
                  </h3>
                  <p className="text-slate-500">{userData?.email}</p>
                  <Badge variant="outline" className="mt-1">
                    {userData?.authProvider || 'Replit'} Account
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card data-testid="card-subscription">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tier.color}`}>
                    <TierIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{tier.name} Plan</h3>
                    <p className="text-sm text-slate-500">{tier.credits} credits/month</p>
                  </div>
                </div>
                <Badge 
                  variant={subscriptionData?.status === 'active' ? 'default' : 'secondary'}
                >
                  {subscriptionData?.status || 'Active'}
                </Badge>
              </div>

              {subscriptionData?.billingPeriodEnd && (
                <p className="text-sm text-slate-500 mb-4">
                  Next billing date: {new Date(subscriptionData.billingPeriodEnd).toLocaleDateString()}
                </p>
              )}

              <div className="flex gap-3">
                {currentTier === 'free' ? (
                  <Button asChild data-testid="button-upgrade">
                    <a href="/pricing">Upgrade Plan</a>
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => portalMutation.mutate()}
                      disabled={portalMutation.isPending}
                      data-testid="button-manage-billing"
                    >
                      {portalMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Manage Billing
                    </Button>
                    <Button asChild variant="ghost" data-testid="button-view-plans">
                      <a href="/pricing">View Plans</a>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Card data-testid="card-signout">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-signout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Danger Zone */}
          <Card className="border-red-200" data-testid="card-danger-zone">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Permanent actions that cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-account">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account, including:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>All your saved projects and workflows</li>
                        <li>Your subscription (will be canceled)</li>
                        <li>Your account data and settings</li>
                        <li>Your authentication connection</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={deleteMutation.isPending}
                      data-testid="button-confirm-delete"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
