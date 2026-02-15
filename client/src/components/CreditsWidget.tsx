import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { Coins, AlertCircle, Crown, Sparkles, Shield } from 'lucide-react';

interface CreditsResponse {
  success: boolean;
  credits: number;
  userIdentifier: string;
  isUnlimited?: boolean;
  isAdmin?: boolean;
  resetsDaily?: boolean;
  dailyAllowance?: number;
  creditCosts?: Record<string, number>;
}

interface RedeemResponse {
  success: boolean;
  message: string;
  credits?: number;
  error?: string;
}

export function CreditsWidget() {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const handleOpenCreditsDialog = () => setIsOpen(true);
    window.addEventListener('openCreditsDialog', handleOpenCreditsDialog);
    return () => window.removeEventListener('openCreditsDialog', handleOpenCreditsDialog);
  }, []);
  const [unlockCode, setUnlockCode] = useState('');
  const { toast } = useToast();
  const { tier, isPro, isAdvanced, dailyCredits } = useSubscription();
  const { isAuthenticated } = useAuth();

  const { data: creditsData, isLoading } = useQuery({
    queryKey: ['/api/credits'],
    refetchInterval: 30000,
  });

  const redeemMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest('POST', '/api/credits/redeem', { code });
      return await res.json() as RedeemResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Success!",
          description: data.message,
        });
        setUnlockCode('');
        queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
      } else {
        toast({
          title: "Redemption Failed",
          description: data.error || "Invalid or already used code",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to redeem unlock code",
        variant: "destructive",
      });
    },
  });

  const handleRedeem = () => {
    const code = unlockCode.trim();
    if (!code) {
      toast({
        title: "Invalid Code",
        description: "Please enter an unlock code",
        variant: "destructive",
      });
      return;
    }
    redeemMutation.mutate(code);
  };

  const credits = (creditsData as CreditsResponse | undefined)?.credits ?? 0;
  const isUnlimited = credits >= 999999;
  const isAdmin = (creditsData as CreditsResponse | undefined)?.isAdmin ?? false;
  const isLowCredits = credits <= 2 && !isUnlimited;
  const displayCredits = isUnlimited ? '∞' : credits;
  const showSignupPrompt = credits === 0 && !isAuthenticated;

  const tierBadge = isAdmin ? (
    <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-violet-600 text-white border-0">
      <Shield className="h-3 w-3 mr-1" />
      Admin
    </Badge>
  ) : tier === 'pro' ? (
    <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
      <Crown className="h-3 w-3 mr-1" />
      Pro
    </Badge>
  ) : tier === 'advanced' ? (
    <Badge variant="default" className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">
      <Sparkles className="h-3 w-3 mr-1" />
      Advanced
    </Badge>
  ) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {tierBadge}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 ${isLowCredits || showSignupPrompt ? 'border-orange-500 text-orange-600' : ''}`}
          data-testid="button-credits"
        >
          <Coins className="h-4 w-4" />
          <span data-testid="text-credits-count">
            {isLoading ? '...' : showSignupPrompt ? '0 credits' : displayCredits}
          </span>
          {(isLowCredits || showSignupPrompt) && <AlertCircle className="h-3 w-3" />}
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent data-testid="dialog-credits">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              AI Credits
              {tierBadge}
            </DialogTitle>
            <DialogDescription>
              You have <strong data-testid="text-credits-remaining">{isUnlimited ? 'unlimited' : credits}</strong> AI credits remaining.
              {isUnlimited && ' You have unlimited AI access.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Daily Allowance: {(creditsData as CreditsResponse | undefined)?.dailyAllowance || 25} credits
              </p>
              <p className="text-xs text-muted-foreground">
                Credits reset every 24 hours automatically.
              </p>
              <div className="text-xs text-muted-foreground space-y-0.5 mt-2 border-t border-border/50 pt-2">
                <p className="font-medium text-foreground/80">Credit costs per action:</p>
                <p>Text chat & refinements: 1 credit</p>
                <p>Workflow generation: 2 credits</p>
                <p>PRD generation: 2 credits</p>
                <p>Image/diagram analysis: 3 credits</p>
              </div>
            </div>

            {credits === 0 && (
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-3">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  {!isAuthenticated ? (
                    "You've used your daily credits. Create an account to get 25 credits per day!"
                  ) : (
                    "You've used all your daily credits. They'll reset in 24 hours, or use an unlock code for bonus credits."
                  )}
                </p>
                {!isAuthenticated && (
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => {
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent('openSignUp'));
                    }}
                    data-testid="button-signup-credits"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Free Account
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="unlock-code" className="text-sm font-medium">
                Unlock Code
              </label>
              <div className="flex gap-2">
                <Input
                  id="unlock-code"
                  type="text"
                  placeholder="Enter unlock code"
                  value={unlockCode}
                  onChange={(e) => setUnlockCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !redeemMutation.isPending) {
                      handleRedeem();
                    }
                  }}
                  disabled={redeemMutation.isPending}
                  data-testid="input-unlock-code"
                />
                <Button
                  onClick={handleRedeem}
                  disabled={redeemMutation.isPending || !unlockCode.trim()}
                  data-testid="button-redeem-code"
                >
                  {redeemMutation.isPending ? 'Redeeming...' : 'Redeem'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Contact <a href="mailto:info@kiteframe.space" className="underline">info@kiteframe.space</a> for unlock codes
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
