export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export type FAQSection = {
  id: string;
  title: string;
  items: FAQItem[];
};

export const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "what-is",
    title: "What is Kiteframe?",
    items: [
      {
        id: "what-is-kiteframe",
        question: "What is Kiteframe?",
        answer:
          "Kiteframe is a workflow-first product design tool that helps teams reason through complex systems before committing to high-fidelity design or code.",
      },
      {
        id: "not-figma-or-miro",
        question: "How is Kiteframe different from Figma or Miro?",
        answer:
          "Kiteframe is not a canvas-first drawing tool. It is designed for structured thinking, behavior modeling, and early decision-making.",
      },
    ],
  },
  {
    id: "drawings",
    title: "Prompts and drawings",
    items: [
      {
        id: "from-sketch",
        question: "Can I create a workflow from a sketch or whiteboard photo?",
        answer:
          "Yes. You can upload a drawing or diagram and Kiteframe will generate a structured workflow proposal based on detected relationships and flow.",
      },
      {
        id: "exact-replica",
        question: "Does Kiteframe recreate my drawing exactly?",
        answer:
          "No. Kiteframe translates intent, not appearance. The result is an editable workflow, not a visual replica.",
      },
    ],
  },
  {
    id: "sharing",
    title: "Sharing and review",
    items: [
      {
        id: "share-workflows",
        question: "Can I share workflows with others?",
        answer:
          "Yes. Workflows can be shared with teammates or stakeholders for asynchronous review.",
      },
      {
        id: "realtime-editing",
        question: "Does Kiteframe support real-time collaboration?",
        answer:
          "No. Kiteframe does not support real-time collaborative editing. Review and iteration are asynchronous.",
      },
    ],
  },
];
