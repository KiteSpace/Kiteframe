import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Chrome, Github, Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

interface SignUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignInClick: () => void;
}

type TierType = 'free' | 'advanced' | 'pro';

export function SignUpModal({ open, onOpenChange, onSignInClick }: SignUpModalProps) {
  const [selectedTier, setSelectedTier] = useState<TierType>('free');
  
  const { data: providersData, isLoading: isLoadingProviders } = useQuery<{ providers: string[] }>({
    queryKey: ['/api/auth/available-providers'],
    enabled: open,
  });

  const availableProviders = providersData?.providers || [];

  const tierInfo = {
    free: {
      name: 'Free',
      credits: 25,
      price: '$0/month',
      features: ['25 AI credits/month', 'Basic workflow editor', 'Download & upload workflows'],
    },
    advanced: {
      name: 'Advanced',
      credits: 50,
      price: '$5/month',
      introLabel: 'Introductory pricing',
      features: ['50 AI credits/month', 'Wireframe generator', 'Cloud storage', 'Priority support'],
    },
    pro: {
      name: 'Pro',
      credits: 150,
      price: '$10/month',
      introLabel: 'Introductory pricing',
      features: ['150 AI credits/month', 'Image-to-Workflow generator', 'Cloud storage', 'Priority support'],
    },
  };

  const handleOAuthSignUp = (provider: string) => {
    const tierParam = selectedTier !== 'free' ? `?tier=${selectedTier}` : '';
    
    if (provider === 'google') {
      window.location.href = `/api/auth/google${tierParam}`;
    } else if (provider === 'github') {
      window.location.href = `/api/auth/github${tierParam}`;
    } else if (provider === 'replit') {
      window.location.href = `/api/login${tierParam}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Your Kiteframe Account</DialogTitle>
          <DialogDescription>
            Choose a plan and sign up with your preferred method
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pricing Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Your Plan</label>
            <div className="grid gap-3">
              {(Object.entries(tierInfo) as [TierType, typeof tierInfo[TierType]][]).map(([tier, info]) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedTier === tier
                      ? 'border-blue-500 bg-blue-50 dark:bg-slate-900 dark:border-blue-400'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  data-testid={`button-tier-${tier}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{info.name}</span>
                        {'introLabel' in info && (
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                            {info.introLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {info.credits.toLocaleString()} credits/month
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">{info.price}</div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedTier === tier
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedTier === tier && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                  {tier === 'pro' && (
                    <Badge className="mt-2 bg-purple-500">Most Popular</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Features of selected tier */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
            <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 mb-3">What's Included</h3>
            <ul className="space-y-2">
              {tierInfo[selectedTier].features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Auth Options */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Sign Up With</label>
            <div className="space-y-3">
              {isLoadingProviders ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {availableProviders.includes('google') && (
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => handleOAuthSignUp('google')}
                      data-testid="button-signup-google"
                    >
                      <Chrome className="h-4 w-4 mr-2" />
                      Google
                    </Button>
                  )}

                  {availableProviders.includes('github') && (
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => handleOAuthSignUp('github')}
                      data-testid="button-signup-github"
                    >
                      <Github className="h-4 w-4 mr-2" />
                      GitHub
                    </Button>
                  )}

                  {availableProviders.includes('replit') && (
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => handleOAuthSignUp('replit')}
                      data-testid="button-signup-replit"
                    >
                      <svg
                        className="h-4 w-4 mr-2"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M3 3h4v4H3V3zm6 0h4v4H9V3zm6 0h4v4h-4V3zM3 9h4v4H3V9zm6 0h4v4H9V9zm6 0h4v4h-4V9zM3 15h4v4H3v-4zm6 0h4v4H9v-4zm6 0h4v4h-4v-4z" />
                      </svg>
                      Replit
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="text-center text-sm text-slate-600 dark:text-slate-300">
            Already have an account?{' '}
            <button
              onClick={() => {
                onOpenChange(false);
                onSignInClick();
              }}
              className="font-medium text-blue-600 hover:text-blue-700 underline"
              data-testid="button-goto-signin"
            >
              Sign in
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
