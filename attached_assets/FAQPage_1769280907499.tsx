
import React from "react";
import { FAQAccordion } from "../components/FAQ/FAQAccordion";
import { FAQ_SECTIONS } from "../components/FAQ/faqContent";

export default function FAQPage() {
  return (
    <main>
      <h1>Kiteframe FAQ</h1>
      <FAQAccordion sections={FAQ_SECTIONS} />
    </main>
  );
}
