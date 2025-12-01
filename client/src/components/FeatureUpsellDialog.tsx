import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface FeatureUpsellDialogProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredTier: 'advanced' | 'pro';
  currentTier: 'free' | 'advanced' | 'pro';
  description: string;
  onUpgrade: () => void;
}

export function FeatureUpsellDialog({
  isOpen,
  onClose,
  featureName,
  requiredTier,
  currentTier,
  description,
  onUpgrade,
}: FeatureUpsellDialogProps) {
  const tierName = requiredTier === 'pro' ? 'Pro' : 'Advanced';
  const isCurrentTierSufficient = 
    (currentTier === 'pro') || 
    (currentTier === 'advanced' && requiredTier === 'advanced');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-blue-500" />
            <DialogTitle>{featureName} is locked</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <p className="text-sm text-foreground">
            This feature is only available in the <span className="font-semibold">{tierName}</span> tier.
          </p>
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              {requiredTier === 'pro' 
                ? 'Upgrade to Pro to unlock advanced features including image-to-workflow generation, version control, and more.'
                : 'Upgrade to Advanced or Pro to unlock this feature along with wireframe generation, cloud storage, and priority support.'}
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={onUpgrade}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
