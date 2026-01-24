import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { FAQ_SECTIONS, HOW_TO_SECTIONS, SECURITY_SECTIONS, type FAQSection } from "@/lib/faqContent";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function FAQAccordion({ sections }: { sections: FAQSection[] }) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      setOpenItems([hash]);
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground border-b pb-2">
            {section.title}
          </h2>
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
            className="space-y-2"
          >
            {section.items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                id={item.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium text-sm">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}

export default function FAQPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("faq");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const inFaq = FAQ_SECTIONS.some(s => s.items.some(i => i.id === hash));
      const inHowTo = HOW_TO_SECTIONS.some(s => s.items.some(i => i.id === hash));
      const inSecurity = SECURITY_SECTIONS.some(s => s.items.some(i => i.id === hash));
      
      if (inHowTo) setActiveTab("howto");
      else if (inSecurity) setActiveTab("security");
      else if (inFaq) setActiveTab("faq");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 -ml-2"
          data-testid="button-faq-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Help Center
          </h1>
          <p className="text-muted-foreground">
            Kiteframe helps teams model workflows and system behavior early, before committing to high-fidelity design or code. It is designed for clarity, alignment, and deliberate decision-making.
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="faq" data-testid="tab-faq">FAQ</TabsTrigger>
            <TabsTrigger value="howto" data-testid="tab-howto">How To</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          </TabsList>
          
          <TabsContent value="faq" className="mt-0">
            <FAQAccordion sections={FAQ_SECTIONS} />
          </TabsContent>
          
          <TabsContent value="howto" className="mt-0">
            <FAQAccordion sections={HOW_TO_SECTIONS} />
          </TabsContent>
          
          <TabsContent value="security" className="mt-0">
            <FAQAccordion sections={SECURITY_SECTIONS} />
          </TabsContent>
        </Tabs>

        <footer className="mt-12 pt-8 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Have more questions?{" "}
            <a
              href="mailto:support@kiteframe.space"
              className="text-primary hover:underline"
            >
              Contact us
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
