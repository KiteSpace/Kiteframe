import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, Zap, Crown, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useReplitAuth } from '@/hooks/useReplitAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: { tier?: string; interval?: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: { tier?: string; credits?: string; features?: string } | null;
  prices: Price[];
}

const tierFeatures = {
  free: [
    '25 AI credits per month',
    'Basic workflow editor',
    'Local project storage',
    'Community support',
  ],
  advanced: [
    '150 AI credits per month',
    'All Free features',
    'Priority AI processing',
    'Advanced templates',
    'Email support',
  ],
  pro: [
    '500 AI credits per month',
    'All Advanced features',
    'Cloud-saved projects',
    'Team collaboration (coming soon)',
    'Priority support',
    'Early access to new features',
  ],
};

const tierIcons = {
  free: Zap,
  advanced: Sparkles,
  pro: Crown,
};

const tierColors = {
  free: 'bg-slate-100 text-slate-800',
  advanced: 'bg-blue-100 text-blue-800',
  pro: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
};

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  const { user, isAuthenticated } = useReplitAuth();
  const { toast } = useToast();

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['/api/products'],
  });

  const { data: subscriptionData } = useQuery<{ tier?: string; status?: string; billingPeriodEnd?: string }>({
    queryKey: ['/api/subscription'],
    enabled: isAuthenticated,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest('POST', '/api/checkout', { priceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Checkout Failed',
        description: error.message || 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const products = productsData?.data || [];
  const currentTier = subscriptionData?.tier || 'free';

  const getPriceForInterval = (product: Product, interval: 'month' | 'year') => {
    return product.prices.find(p => p.recurring?.interval === interval);
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const handleSelectPlan = (priceId: string) => {
    if (!isAuthenticated) {
      window.location.href = '/api/login';
      return;
    }
    checkoutMutation.mutate(priceId);
  };

  if (productsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const advancedProduct = products.find(p => p.metadata?.tier === 'advanced');
  const proProduct = products.find(p => p.metadata?.tier === 'pro');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            Unlock the full potential of KiteAI with our flexible pricing plans.
            Start free and upgrade as you grow.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Label htmlFor="billing-toggle" className={!isAnnual ? 'font-semibold' : ''}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              data-testid="billing-toggle"
            />
            <Label htmlFor="billing-toggle" className={isAnnual ? 'font-semibold' : ''}>
              Annual
            </Label>
            {isAnnual && (
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                Save 20%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Tier */}
          <Card className="relative border-2 hover:border-slate-300 transition-colors" data-testid="card-tier-free">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${tierColors.free}`}>
                  <Zap className="h-5 w-5" />
                </div>
                <CardTitle>Free</CardTitle>
              </div>
              <CardDescription>Perfect for getting started</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-slate-500">/month</span>
              </div>
              <ul className="space-y-3">
                {tierFeatures.free.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                disabled={currentTier === 'free'}
                data-testid="button-select-free"
              >
                {currentTier === 'free' ? 'Current Plan' : 'Downgrade'}
              </Button>
            </CardFooter>
          </Card>

          {/* Advanced Tier */}
          <Card className="relative border-2 hover:border-blue-300 transition-colors" data-testid="card-tier-advanced">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${tierColors.advanced}`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <CardTitle>Advanced</CardTitle>
              </div>
              <CardDescription>For power users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                {advancedProduct ? (
                  <>
                    <span className="text-4xl font-bold">
                      {formatPrice(
                        (isAnnual
                          ? getPriceForInterval(advancedProduct, 'year')?.unit_amount || 0
                          : getPriceForInterval(advancedProduct, 'month')?.unit_amount || 0) / (isAnnual ? 12 : 1)
                      )}
                    </span>
                    <span className="text-slate-500">/month</span>
                    {isAnnual && (
                      <p className="text-sm text-slate-500 mt-1">
                        Billed {formatPrice(getPriceForInterval(advancedProduct, 'year')?.unit_amount || 0)} annually
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-4xl font-bold">$14.99</span>
                )}
              </div>
              <ul className="space-y-3">
                {tierFeatures.advanced.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                disabled={currentTier === 'advanced' || checkoutMutation.isPending}
                onClick={() => {
                  const price = isAnnual
                    ? getPriceForInterval(advancedProduct!, 'year')
                    : getPriceForInterval(advancedProduct!, 'month');
                  if (price) handleSelectPlan(price.id);
                }}
                data-testid="button-select-advanced"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {currentTier === 'advanced' ? 'Current Plan' : 'Upgrade to Advanced'}
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Tier */}
          <Card className="relative border-2 border-purple-300 hover:border-purple-400 transition-colors shadow-lg" data-testid="card-tier-pro">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                Most Popular
              </Badge>
            </div>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${tierColors.pro}`}>
                  <Crown className="h-5 w-5" />
                </div>
                <CardTitle>Pro</CardTitle>
              </div>
              <CardDescription>For professionals and teams</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                {proProduct ? (
                  <>
                    <span className="text-4xl font-bold">
                      {formatPrice(
                        (isAnnual
                          ? getPriceForInterval(proProduct, 'year')?.unit_amount || 0
                          : getPriceForInterval(proProduct, 'month')?.unit_amount || 0) / (isAnnual ? 12 : 1)
                      )}
                    </span>
                    <span className="text-slate-500">/month</span>
                    {isAnnual && (
                      <p className="text-sm text-slate-500 mt-1">
                        Billed {formatPrice(getPriceForInterval(proProduct, 'year')?.unit_amount || 0)} annually
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-4xl font-bold">$29.99</span>
                )}
              </div>
              <ul className="space-y-3">
                {tierFeatures.pro.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                disabled={currentTier === 'pro' || checkoutMutation.isPending}
                onClick={() => {
                  const price = isAnnual
                    ? getPriceForInterval(proProduct!, 'year')
                    : getPriceForInterval(proProduct!, 'month');
                  if (price) handleSelectPlan(price.id);
                }}
                data-testid="button-select-pro"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {currentTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>
          <div className="max-w-2xl mx-auto text-left space-y-6">
            <div>
              <h3 className="font-medium text-slate-900">What are AI credits?</h3>
              <p className="text-slate-600 text-sm mt-1">
                AI credits are used each time you generate workflows, get AI suggestions, or use any AI-powered features.
                Each plan comes with a monthly allocation that resets on your billing date.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Can I upgrade or downgrade anytime?</h3>
              <p className="text-slate-600 text-sm mt-1">
                Yes! You can change your plan at any time. When upgrading, you'll be charged the prorated amount.
                When downgrading, your new rate takes effect at the next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-900">What are cloud-saved projects?</h3>
              <p className="text-slate-600 text-sm mt-1">
                Pro users can save their workflows to the cloud, access them from any device, and share them with team members.
                Your projects are securely stored and always backed up.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
