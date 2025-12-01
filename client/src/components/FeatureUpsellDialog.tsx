import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

  const handleSignIn = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('openSignIn'));
  };

  const handleSignUp = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('openSignUp'));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-0">
        <div className="p-6">
          {/* Gradient Header */}
          <div 
            className="mb-4 -mx-6 -mt-6 px-6 py-4"
            style={{
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)'
            }}
          >
            <h2 className="text-lg font-semibold text-foreground">
              Sign up for a {tierName} Account to access this feature
            </h2>
          </div>

          {/* Description */}
          <p className="text-muted-foreground mb-6">
            {description}
          </p>

          {/* Action Buttons */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
