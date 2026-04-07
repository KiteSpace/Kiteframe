import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useReplitAuth } from '@/hooks/useReplitAuth';
import { useSubscription } from '@/hooks/useSubscription';

interface FeatureUpsellDialogProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredTier: 'advanced' | 'pro';
  description: string;
}

export function FeatureUpsellDialog({
  isOpen,
  onClose,
  featureName,
  requiredTier,
  description,
}: FeatureUpsellDialogProps) {
  const tierName = requiredTier === 'pro' ? 'Pro' : 'Advanced';
  const [, navigate] = useLocation();
  const { isAuthenticated: isFirebaseAuthenticated } = useAuth();
  const { isAuthenticated: isReplitAuthenticated } = useReplitAuth();
  const { isServerAuthenticated } = useSubscription();

  const isAuthenticated = isFirebaseAuthenticated || isReplitAuthenticated || isServerAuthenticated;

  const handleSignIn = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('openSignIn'));
  };

  const handleSignUp = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('openSignUp'));
  };

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-0">
        <div className="p-6">
          <div
            className="mb-4 -mx-6 -mt-6 px-6 py-4"
            style={{
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)'
            }}
          >
            <h2 className="text-lg font-semibold text-foreground">
              {isAuthenticated
                ? `${tierName} plan required`
                : `Sign up for a ${tierName} Account to access this feature`}
            </h2>
          </div>

          <p className="text-muted-foreground mb-6">
            {description}
          </p>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                data-testid="button-cancel-upsell"
              >
                Maybe later
              </Button>
              <Button
                type="button"
                onClick={handleUpgrade}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-upgrade-upsell"
              >
                Upgrade to {tierName}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSignIn}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                data-testid="button-signin-upsell"
              >
                Sign in
              </Button>
              <Button
                type="button"
                onClick={handleSignUp}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-signup-upsell"
              >
                Sign up
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
