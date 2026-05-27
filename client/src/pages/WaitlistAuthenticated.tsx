import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Loader2, Clock, Mail } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FullBleedSection } from '@/components/layout/FullBleedSection';
import { apiRequest } from '@/lib/queryClient';
import { useRecaptcha } from '@/hooks/useRecaptcha';

type WaitlistRole = 'pm' | 'design' | 'engineering' | 'founder';

const ROLE_LABELS: Record<WaitlistRole, string> = {
  pm: 'Product Management',
  design: 'Design',
  engineering: 'Engineering',
  founder: 'Founder / Solo Builder',
};

export default function WaitlistAuthenticated() {
  const [role, setRole] = useState<WaitlistRole | ''>('');
  const [useCase, setUseCase] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { getToken } = useRecaptcha();

  const { data: userData } = useQuery<{
    id: string;
    email: string;
    waitlistRequestedAt: string | null;
    waitlistRole: string | null;
    waitlistUseCase: string | null;
  }>({
    queryKey: ['/api/auth/user'],
  });

  const alreadyOnWaitlist = !!userData?.waitlistRequestedAt;

  useEffect(() => {
    if (userData?.waitlistRole) {
      setRole(userData.waitlistRole as WaitlistRole);
    }
    if (userData?.waitlistUseCase) {
      setUseCase(userData.waitlistUseCase);
    }
  }, [userData]);

  const waitlistMutation = useMutation({
    mutationFn: async (data: { role?: string; useCase?: string; recaptchaToken?: string }) => {
      return apiRequest('POST', '/api/waitlist/update', data);
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
  });

  const handleSubmit = async () => {
    const recaptchaToken = await getToken('waitlist') ?? undefined;
    waitlistMutation.mutate({
      role: role || undefined,
      useCase: useCase || undefined,
      ...(recaptchaToken && { recaptchaToken }),
    });
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div className="min-h-screen bg-background">
      <FullBleedSection className="min-h-[60vh]">
        <div className="relative z-10 py-20 flex flex-col items-center max-w-2xl mx-auto px-6">
          <div className="w-full bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50 p-8">
            {alreadyOnWaitlist || isSubmitted ? (
              <div className="text-center" data-testid="waitlist-confirmed">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-3" data-testid="text-waitlist-confirmed-headline">
                  You're on the waitlist!
                </h1>
                <p className="text-muted-foreground mb-6" data-testid="text-waitlist-confirmed-body">
                  Thanks for your interest in Kiteframe. We're currently in beta and granting access in waves.
                </p>
                
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>We'll email you at <strong className="text-foreground">{userData?.email}</strong> when your access is ready.</span>
                  </div>
                </div>

                {!isSubmitted && (
                  <div className="space-y-4 text-left border-t border-border pt-6">
                    <h3 className="font-medium text-sm text-foreground">Update your waitlist info (optional)</h3>
                    <Select value={role} onValueChange={(v) => setRole(v as WaitlistRole)}>
                      <SelectTrigger className="h-11" data-testid="select-waitlist-role">
                        <SelectValue placeholder="How will you use Kiteframe?" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as WaitlistRole[]).map((r) => (
                          <SelectItem key={r} value={r} data-testid={`option-role-${r}`}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Textarea
                      placeholder="What are you hoping to build?"
                      value={useCase}
                      onChange={(e) => setUseCase(e.target.value)}
                      className="min-h-[80px] resize-none"
                      data-testid="input-waitlist-usecase"
                    />

                    <Button
                      onClick={handleSubmit}
                      disabled={waitlistMutation.isPending}
                      variant="outline"
                      className="w-full"
                      data-testid="button-update-waitlist"
                    >
                      {waitlistMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Update
                    </Button>
                  </div>
                )}

                {isSubmitted && (
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <Check className="w-4 h-4" />
                    <span>Your info has been updated</span>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-border">
                  <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground" data-testid="button-logout">
                    Sign out
                  </Button>
                </div>
              </div>
            ) : (
              <div data-testid="waitlist-signup">
                <h1 className="text-2xl font-bold text-foreground mb-3" data-testid="text-waitlist-headline">
                  Almost there!
                </h1>
                <p className="text-muted-foreground mb-6" data-testid="text-waitlist-body">
                  Kiteframe is currently in beta. Let us know how you'd use it and we'll notify you when access is available.
                </p>

                <div className="space-y-4">
                  <Select value={role} onValueChange={(v) => setRole(v as WaitlistRole)}>
                    <SelectTrigger className="h-11" data-testid="select-waitlist-role">
                      <SelectValue placeholder="How will you use Kiteframe? (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as WaitlistRole[]).map((r) => (
                        <SelectItem key={r} value={r} data-testid={`option-role-${r}`}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Textarea
                    placeholder="What are you hoping to build? (optional)"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    className="min-h-[80px] resize-none"
                    data-testid="input-waitlist-usecase"
                  />

                  <Button
                    onClick={handleSubmit}
                    disabled={waitlistMutation.isPending}
                    className="w-full h-11"
                    data-testid="button-join-waitlist"
                  >
                    {waitlistMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Join the Waitlist
                  </Button>
                </div>

                <div className="mt-6 pt-4 border-t border-border text-center">
                  <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground text-sm" data-testid="button-logout">
                    Sign in with a different account
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </FullBleedSection>
    </div>
  );
}
