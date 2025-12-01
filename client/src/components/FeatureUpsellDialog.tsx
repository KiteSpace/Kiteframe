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
  const tierName = requiredTier === 'pro' ? 'Pro' : 'Advanced';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Sign up for a {tierName} Account to access this feature</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <p className="text-base text-foreground leading-relaxed">
            {description}
          </p>
          
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-lg">
            <p className="text-sm font-medium">
              {requiredTier === 'pro' 
                ? 'Pro accounts include image-to-workflow generation, version control, cloud storage, and 500 monthly credits.'
                : 'Advanced accounts include wireframe generation, priority support, advanced exports, and 150 monthly credits.'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onSignIn}
            className="px-6"
          >
            Sign in
          </Button>
          <Button
            onClick={onSignUp}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            Sign up
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
