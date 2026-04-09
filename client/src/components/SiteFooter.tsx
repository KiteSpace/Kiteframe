import { useState } from "react";
import { Check, Loader2, Send, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRecaptcha } from "@/hooks/useRecaptcha";

export function SiteFooter() {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', website: '' });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const { toast } = useToast();
  const { getToken } = useRecaptcha();

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactSubmitting || !contactForm.name || !contactForm.email || !contactForm.message) return;

    setContactSubmitting(true);
    try {
      const recaptchaToken = await getToken('contact');
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name,
          email: contactForm.email,
          message: contactForm.message,
          ...(recaptchaToken && { recaptchaToken }),
          ...(contactForm.website && { website: contactForm.website }),
        }),
      });

      if (response.ok) {
        setContactSubmitted(true);
        setContactForm({ name: '', email: '', message: '', website: '' });
        toast({
          title: "Message sent!",
          description: "We'll get back to you as soon as possible.",
        });
      } else {
        const data = await response.json();
        toast({
          title: "Failed to send",
          description: data.error || "Please try again later.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setContactSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
          {/* Left side - Branding and links */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-semibold text-foreground">Kiteframe</span>
              <span className="text-sm text-muted-foreground">· Early Access</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Visual workflow planning for product teams.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <a href="/faq" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-faq">
                FAQ
              </a>
              <a href="/legal#terms" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-terms">
                Terms
              </a>
              <a href="/legal#privacy" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-privacy">
                Privacy
              </a>
            </div>
          </div>

          {/* Right side - Contact form */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contact Us
            </h3>
            {contactSubmitted ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Thanks! We'll be in touch soon.</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3">
                {/* Honeypot field - hidden from users, visible to bots */}
                <div className="absolute left-[-9999px]" aria-hidden="true">
                  <Input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={contactForm.website}
                    onChange={(e) => setContactForm({ ...contactForm, website: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="text"
                    placeholder="Name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                    className="h-9 text-sm"
                    data-testid="input-contact-name"
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                    className="h-9 text-sm"
                    data-testid="input-contact-email"
                  />
                </div>
                <Textarea
                  placeholder="Your message..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                  rows={3}
                  className="text-sm resize-none"
                  data-testid="input-contact-message"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={contactSubmitting}
                  className="w-full"
                  data-testid="button-contact-submit"
                >
                  {contactSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Message
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center md:text-left border-t border-slate-200 dark:border-slate-800 pt-6">
          <p className="text-sm text-muted-foreground" data-testid="text-footer">
            © 2025 Kitespace LLC. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Kiteframe is a product of Kitespace LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}
