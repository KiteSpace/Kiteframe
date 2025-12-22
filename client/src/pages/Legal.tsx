import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, FileText, Shield, Users, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type DocumentType = 'terms' | 'privacy' | 'beta-expectations' | 'beta-confidentiality';

const documents: Record<DocumentType, { title: string; icon: typeof FileText; content: string }> = {
  'terms': {
    title: 'Terms and Conditions',
    icon: FileText,
    content: `KITEFRAME — TERMS AND CONDITIONS (BETA)

Last edited: 12/22/25

Kiteframe is a product of Kitespace, LLC, a Wyoming limited liability company.

These Terms and Conditions ("Terms") govern your access to and use of Kiteframe ("Kiteframe," "we," "us," or "our"), including the Kiteframe web application, AI-powered features, and related services (the "Service").

By accessing or using the Service, you agree to be bound by these Terms.

---

1. BETA SERVICE STATUS

Kiteframe is offered as a private beta and provided "AS IS" without warranties of any kind.

---

2. ELIGIBILITY AND ACCESS

Access is granted at Kiteframe's sole discretion and may be revoked at any time.

---

3. ACCEPTABLE USE

You agree not to violate laws, third‑party rights, or your organization's data/IP policies.

---

4. AI-GENERATED CONTENT DISCLAIMER

AI outputs may be inaccurate and require human review.

---

5. INTELLECTUAL PROPERTY

All platform IP remains the property of Kitespace, LLC. Users retain ownership of their content.

---

6. CONFIDENTIALITY

The Service and its features are confidential during beta.

---

7. LIMITATION OF LIABILITY

Kitespace, LLC shall not be liable for indirect or consequential damages.

---

8. GOVERNING LAW

These Terms are governed by the laws of the State of Wyoming.`
  },
  'privacy': {
    title: 'Privacy Policy',
    icon: Shield,
    content: `KITEFRAME — PRIVACY POLICY (BETA)

Last edited: 12/22/25

Kiteframe is a product of Kitespace, LLC, a Wyoming limited liability company.

This Privacy Policy explains how Kiteframe handles user information.

---

1. INFORMATION COLLECTED

Account info, usage metrics, and user-provided content.

---

2. DATA USAGE

Used solely to operate and improve the Service.

---

3. AI PROCESSING

User data is not used to train AI models. AI usage follows OpenAI and third-party policies.

---

4. DATA ACCESS

Projects are not accessed unless explicitly shared or required for support with consent.

---

5. SECURITY

Reasonable safeguards are applied; no system is fully secure.

---

6. USER RESPONSIBILITY

Users must comply with their organization's data and IP rules.

---

7. DATA RETENTION

Data retained only as long as necessary to operate the Service.

Contact: info@kiteframe.space`
  },
  'beta-expectations': {
    title: 'Beta Expectations',
    icon: Users,
    content: `KITEFRAME — BETA EXPECTATIONS

Last edited: 12/22/25

Kiteframe is a product of Kitespace, LLC, a Wyoming limited liability company.

---

WHAT THIS BETA IS

An early-access environment for validating workflows and canvas performance.

---

EXPECTATIONS

• Provide feedback
• Respect confidentiality
• Avoid public sharing

---

DATA & AI

• Do not upload sensitive data without authorization
• AI outputs require human judgment

---

CONFIDENTIALITY

Kiteframe is not public. Do not share screenshots or demos.`
  },
  'beta-confidentiality': {
    title: 'Beta Confidentiality Agreement',
    icon: Lock,
    content: `KITEFRAME — BETA CONFIDENTIALITY AGREEMENT

Last edited: 12/22/25

Kiteframe is a product of Kitespace, LLC, a Wyoming limited liability company.

By participating in the Kiteframe beta, you agree:

---

1. CONFIDENTIAL INFORMATION

Includes non-public features, screenshots, recordings, and documentation.

---

2. RESTRICTIONS

No public sharing or credential sharing without written consent.

---

3. FEEDBACK

Feedback may be used by Kitespace, LLC without obligation.

---

4. TERM

Applies until public launch or access revocation.`
  }
};

const navItems: { id: DocumentType; label: string }[] = [
  { id: 'terms', label: 'Terms and Conditions' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'beta-expectations', label: 'Beta Expectations' },
  { id: 'beta-confidentiality', label: 'Beta Confidentiality' },
];

export default function Legal() {
  const [activeDoc, setActiveDoc] = useState<DocumentType>(() => {
    const hash = window.location.hash.replace('#', '') as DocumentType;
    return hash && documents[hash] ? hash : 'terms';
  });

  useEffect(() => {
    const updateFromHash = () => {
      const hash = window.location.hash.replace('#', '') as DocumentType;
      if (hash && documents[hash] && hash !== activeDoc) {
        setActiveDoc(hash);
      }
    };
    
    window.addEventListener('hashchange', updateFromHash);
    window.addEventListener('popstate', updateFromHash);
    
    return () => {
      window.removeEventListener('hashchange', updateFromHash);
      window.removeEventListener('popstate', updateFromHash);
    };
  }, [activeDoc]);

  const handleNavClick = (docId: DocumentType) => {
    setActiveDoc(docId);
    window.history.pushState(null, '', `/legal#${docId}`);
  };

  const currentDoc = documents[activeDoc];
  const Icon = currentDoc.icon;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-home">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xl font-bold text-foreground" data-testid="text-logo">Kiteframe</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        <nav className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-65px)] p-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 px-3">
            Legal Documents
          </h2>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const ItemIcon = documents[item.id].icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                      activeDoc === item.id
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    )}
                    data-testid={`nav-${item.id}`}
                  >
                    <ItemIcon className="h-4 w-4" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1 p-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Icon className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-document-title">
                {currentDoc.title}
              </h1>
            </div>

            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="prose prose-slate dark:prose-invert max-w-none" data-testid="text-document-content">
                {currentDoc.content.split('\n\n').map((paragraph, idx) => {
                  if (paragraph.startsWith('---')) {
                    return <hr key={idx} className="my-6 border-slate-200 dark:border-slate-700" />;
                  }
                  if (paragraph.match(/^\d+\./)) {
                    const [heading, ...rest] = paragraph.split('\n');
                    return (
                      <div key={idx} className="mb-4">
                        <h3 className="text-lg font-semibold text-foreground mb-2">{heading}</h3>
                        {rest.length > 0 && <p className="text-slate-600 dark:text-slate-400">{rest.join('\n')}</p>}
                      </div>
                    );
                  }
                  if (paragraph.startsWith('•')) {
                    return (
                      <ul key={idx} className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1 mb-4">
                        {paragraph.split('\n').map((line, lineIdx) => (
                          <li key={lineIdx}>{line.replace('• ', '')}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (paragraph.match(/^[A-Z]{2,}/)) {
                    return (
                      <h2 key={idx} className="text-xl font-bold text-foreground mt-6 mb-2">
                        {paragraph}
                      </h2>
                    );
                  }
                  if (paragraph.startsWith('Contact:') || paragraph.startsWith('Last edited:')) {
                    return (
                      <p key={idx} className="text-sm text-muted-foreground italic mb-2">
                        {paragraph}
                      </p>
                    );
                  }
                  return (
                    <p key={idx} className="text-slate-600 dark:text-slate-400 mb-4">
                      {paragraph}
                    </p>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              © 2025 Kitespace LLC. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Kiteframe is a product of Kitespace LLC.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => handleNavClick('terms')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-footer-terms"
            >
              Terms
            </button>
            <button
              onClick={() => handleNavClick('privacy')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-footer-privacy"
            >
              Privacy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
