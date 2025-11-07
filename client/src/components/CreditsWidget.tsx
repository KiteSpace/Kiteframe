import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Coins, AlertCircle } from 'lucide-react';

interface CreditsResponse {
  success: boolean;
  credits: number;
  userIdentifier: string;
}

interface RedeemResponse {
  success: boolean;
  message: string;
  credits?: number;
  error?: string;
}

export function CreditsWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const { toast } = useToast();

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
  const isLowCredits = credits <= 2 && !isUnlimited;
  const displayCredits = isUnlimited ? '∞' : credits;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 ${isLowCredits ? 'border-orange-500 text-orange-600' : ''}`}
        data-testid="button-credits"
      >
        <Coins className="h-4 w-4" />
        <span data-testid="text-credits-count">{isLoading ? '...' : displayCredits}</span>
        {isLowCredits && <AlertCircle className="h-3 w-3" />}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent data-testid="dialog-credits">
          <DialogHeader>
            <DialogTitle>AI Credits</DialogTitle>
            <DialogDescription>
              You have <strong data-testid="text-credits-remaining">{isUnlimited ? 'unlimited' : credits}</strong> AI credits remaining.
              {!isUnlimited && ' Each AI operation uses 1 credit.'}
              {isUnlimited && ' You have unlimited AI access.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {credits === 0 && (
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  You've run out of credits. Enter an unlock code to continue using AI features.
                </p>
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
