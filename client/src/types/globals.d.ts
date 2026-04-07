export {};

declare global {
  interface Window {
    __subscriptionTier?: 'free' | 'advanced' | 'pro';
  }
}
