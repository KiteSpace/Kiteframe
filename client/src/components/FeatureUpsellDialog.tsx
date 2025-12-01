import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FeatureUpsellDialogProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredTier: 'advanced' | 'pro';
  currentTier: 'free' | 'advanced' | 'pro';
  description: string;
  onSignIn: () => void;
  onSignUp: () => void;
}

export function FeatureUpsellDialog({
  isOpen,
  onClose,
  featureName,
  requiredTier,
  currentTier,
  description,
  onSignIn,
  onSignUp,
}: FeatureUpsellDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] border-0 shadow-lg">
        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="text-xl font-semibold">Sign up for a Pro Account to access this feature</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <p className="text-base text-foreground leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onSignIn}
            className="px-8"
          >
            Sign in
          </Button>
          <Button
            onClick={onSignUp}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8"
          >
            Sign up
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
