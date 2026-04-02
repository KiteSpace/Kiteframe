declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

let scriptLoaded = false;

function loadScript(): Promise<void> {
  if (scriptLoaded || !SITE_KEY) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-recaptcha]');
    if (existing) { scriptLoaded = true; resolve(); return; }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.dataset.recaptcha = '1';
    script.async = true;
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function useRecaptcha() {
  const getToken = async (action: string): Promise<string | null> => {
    if (!SITE_KEY) return null;
    try {
      await loadScript();
      return await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(SITE_KEY!, { action }).then(resolve).catch(reject);
        });
      });
    } catch {
      return null;
    }
  };

  return { getToken, enabled: !!SITE_KEY };
}
