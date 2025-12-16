import { useState, lazy, Suspense } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Redirect, Link } from 'wouter';
import { User, LogOut, Clock, Mail, Loader2, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getQueryFn } from '@/lib/queryClient';

const FloatingShapes = lazy(() => import('@/components/landing/FloatingShapes'));

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  authProvider?: string;
  isBeta?: boolean;
  waitlistRequestedAt?: string | null;
  waitlistRole?: string | null;
}

export default function WaitlistDashboard() {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/account', {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Removed from Waitlist',
        description: 'Your information has been deleted. You can rejoin the waitlist at any time.',
      });
      window.location.href = '/';
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Unable to remove from waitlist. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/signin" />;
  }

  if (user.isBeta) {
    return <Redirect to="/app" />;
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not recorded';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen relative bg-white dark:bg-slate-950">
      <Suspense fallback={null}>
        <FloatingShapes />
      </Suspense>

      <div className="relative z-10 min-h-screen">
        <header className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/">
              <a className="text-xl font-bold text-foreground hover:text-violet-600 transition-colors" data-testid="text-logo">
                Kiteframe
              </a>
            </Link>
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 rounded-full">
              Private Beta
            </span>
          </div>
          <Button variant="ghost" onClick={handleLogout} data-testid="button-logout-header">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-dashboard-title">
              You're on the Waitlist
            </h1>
            <p className="text-muted-foreground">
              Thanks for your interest in Kiteframe! We'll notify you when your access is ready.
            </p>
          </div>

          <div className="space-y-6">
            <Card data-testid="card-waitlist-status">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-violet-500" />
                  Waitlist Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Joined waitlist</p>
                    <p className="font-medium text-foreground">{formatDate(user.waitlistRequestedAt)}</p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                    Pending Access
                  </Badge>
                </div>
                {user.waitlistRole && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium text-foreground capitalize">{user.waitlistRole}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-profile">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Your Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={user.profileImageUrl || ''} />
                    <AvatarFallback>
                      {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.email || 'User'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email}
                    </div>
                    <Badge variant="outline" className="mt-1.5 text-xs">
                      {user.authProvider || 'Replit'} Account
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-900/50" data-testid="card-remove">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <UserMinus className="h-5 w-5" />
                  Remove from Waitlist
                </CardTitle>
                <CardDescription>
                  You will be removed from the waitlist and your information will be deleted. 
                  You can rejoin the waitlist at any time by submitting another request.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" data-testid="button-remove-waitlist">
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove from Waitlist
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove you from the waitlist and delete your account information. 
                        You can rejoin the waitlist at any time by submitting a new request on our homepage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={removeMutation.isPending}
                        data-testid="button-confirm-remove"
                      >
                        {removeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Remove & Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <div className="text-center pt-4">
              <Button variant="ghost" onClick={handleLogout} data-testid="button-logout-bottom">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
