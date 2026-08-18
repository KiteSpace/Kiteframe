
import React, { useState, useEffect } from "react";
import { FAQSection } from "./faqContent";

export function FAQAccordion({ sections }: { sections: FAQSection[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) setOpenId(hash);
  }, []);

  return (
    <div>
      {sections.map((section) => (
        <section key={section.id}>
          <h2>{section.title}</h2>
          {section.items.map((item) => (
            <div key={item.id} id={item.id}>
              <button onClick={() => setOpenId(item.id)}>
                {item.question}
              </button>
              {openId === item.id && <p>{item.answer}</p>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
