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
    id: "what-is-kiteframe",
    title: "What is Kiteframe?",
    items: [
      {
        id: "what-is",
        question: "What is Kiteframe?",
        answer:
          "Kiteframe is a workflow-first product design tool that helps teams reason through complex systems. It combines structured workflows, low-fidelity visual artifacts, and AI-assisted proposals so teams can align on behavior and scope before committing to design or implementation.",
      },
      {
        id: "different-from-figma",
        question: "How is Kiteframe different from Figma, Miro, or diagramming tools?",
        answer:
          "Kiteframe is not a canvas-first drawing tool. It is designed for structured thinking and system reasoning. You start with intent and flow, then use visuals to support understanding rather than presentation.",
      },
      {
        id: "diagramming-or-design",
        question: "Is Kiteframe a diagramming tool or a design tool?",
        answer:
          "It sits between the two. Kiteframe focuses on process, logic, and behavior. It complements design tools by clarifying structure before visual execution.",
      },
    ],
  },
  {
    id: "who-is-for",
    title: "Who is Kiteframe for?",
    items: [
      {
        id: "who-should-use",
        question: "Who should use Kiteframe?",
        answer:
          "Kiteframe is designed for product designers, UX designers, product managers, founders, and engineers who need to align on how a system behaves.",
      },
      {
        id: "early-stage-only",
        question: "Is Kiteframe only for early-stage work?",
        answer:
          "No. Early teams use Kiteframe to clarify ideas. Mature teams use it to reason about changes, edge cases, and system evolution.",
      },
      {
        id: "need-to-code",
        question: "Do I need to code to use Kiteframe?",
        answer:
          "No. Kiteframe does not require coding, but it supports technical thinking.",
      },
    ],
  },
  {
    id: "how-to-think",
    title: "How to think in Kiteframe",
    items: [
      {
        id: "think-about-workflow",
        question: "How should I think about a workflow in Kiteframe?",
        answer:
          "A workflow in Kiteframe is a shared reasoning surface. It represents how something might behave, not how it must behave.",
      },
      {
        id: "ambiguity-problem",
        question: "Is ambiguity a problem?",
        answer:
          "No. Ambiguity is expected and useful. Kiteframe is designed to surface uncertainty early, when it is cheaper and safer to resolve.",
      },
      {
        id: "strict-schemas",
        question: "Why doesn't Kiteframe enforce strict schemas or rules?",
        answer:
          "Premature structure often hides uncertainty. Kiteframe keeps structure flexible so teams can reason before committing to rigid definitions.",
      },
    ],
  },
  {
    id: "prompts-drawings",
    title: "Prompts, drawings, and inputs",
    items: [
      {
        id: "from-sketch",
        question: "Can I create a workflow from a sketch or whiteboard photo?",
        answer:
          "Yes. You can upload a drawing or diagram and Kiteframe will generate a structured workflow proposal based on detected steps, relationships, and flow.",
      },
      {
        id: "exact-replica",
        question: "Does Kiteframe recreate my drawing exactly?",
        answer:
          "No. Kiteframe focuses on meaning, not appearance. The result is an editable workflow proposal, not a visual replica.",
      },
      {
        id: "best-drawings",
        question: "What kinds of drawings work best?",
        answer:
          "Hand-drawn flows, whiteboard diagrams, and low-fidelity sketches that show steps, arrows, and branching work best. Neatness is not required.",
      },
      {
        id: "combine-drawing-prompt",
        question: "Can I combine a drawing with a text prompt?",
        answer:
          "Yes. Combining a sketch with a short description often produces better results.",
      },
    ],
  },
  {
    id: "limitations",
    title: "Limitations and failure modes",
    items: [
      {
        id: "not-good-at",
        question: "What is Kiteframe not good at?",
        answer:
          "Kiteframe is not intended for: pixel-perfect UI design, final production documentation, strict execution logic, or fully specified systems with no ambiguity.",
      },
      {
        id: "ai-wrong",
        question: "What happens if AI gets it wrong?",
        answer:
          "That is expected. AI output is a proposal. You should review, edit, restructure, or discard it as needed.",
      },
      {
        id: "drawing-incorrect",
        question: "Can drawing interpretation be incorrect?",
        answer:
          "Yes. Drawings are interpreted heuristically. The output should be treated as a starting point, not a conversion.",
      },
    ],
  },
  {
    id: "ai-automation",
    title: "AI, automation, and trust",
    items: [
      {
        id: "what-ai-does",
        question: "What does AI do in Kiteframe?",
        answer:
          "AI helps generate workflow proposals, expand existing workflows, suggest alternatives, and identify missing paths. AI output is always treated as draft material.",
      },
      {
        id: "overwrite-work",
        question: "Does Kiteframe overwrite my work?",
        answer:
          "No. AI changes are previewed and applied intentionally by the user.",
      },
      {
        id: "trust-output",
        question: "Can I trust the output?",
        answer:
          "AI output should be trusted as a starting point, not a source of truth. Human review and judgment are always required.",
      },
    ],
  },
  {
    id: "workflows-fidelity",
    title: "Workflows and fidelity",
    items: [
      {
        id: "low-fidelity",
        question: "Why are the visuals low-fidelity?",
        answer:
          "Low fidelity prevents premature commitment and keeps discussion focused on behavior and flow rather than polish.",
      },
      {
        id: "nodes-screens",
        question: "Are nodes equivalent to screens or components?",
        answer:
          "Not necessarily. A node represents a step or concept. Interpretation is left to the team.",
      },
      {
        id: "strict-inputs-outputs",
        question: "Does Kiteframe require strict inputs and outputs?",
        answer:
          "No. Nodes are intentionally neutral. Meaning emerges from structure and context.",
      },
    ],
  },
  {
    id: "sharing-review",
    title: "Sharing and review",
    items: [
      {
        id: "share-workflows",
        question: "Can I share workflows with others?",
        answer:
          "Yes. Workflows can be shared with teammates or stakeholders for asynchronous review.",
      },
      {
        id: "realtime-collab",
        question: "Does Kiteframe support real-time collaboration?",
        answer:
          "No. Kiteframe does not support real-time collaborative editing.",
      },
      {
        id: "feedback-handled",
        question: "How is feedback handled?",
        answer:
          "Feedback is handled through review and discussion rather than live co-editing, preserving clarity of authorship.",
      },
    ],
  },
  {
    id: "export-handoff",
    title: "Export and handoff",
    items: [
      {
        id: "what-export",
        question: "What can I export from Kiteframe?",
        answer:
          "Kiteframe supports exports intended for product, design, and engineering alignment. Export options depend on plan and feature availability.",
      },
      {
        id: "replace-prds",
        question: "Does Kiteframe replace PRDs or specs?",
        answer:
          "No. Kiteframe supports reasoning and alignment, but does not replace formal documentation.",
      },
    ],
  },
  {
    id: "data-security",
    title: "Data and security",
    items: [
      {
        id: "content-ownership",
        question: "Who owns the content I create?",
        answer:
          "You do. You retain ownership of your workflows and content.",
      },
      {
        id: "data-train-ai",
        question: "Is my data used to train AI models?",
        answer:
          "No. Private customer data is not used to train AI models.",
      },
      {
        id: "learn-security",
        question: "Where can I learn more about security?",
        answer:
          "See the Security page for detailed information.",
      },
    ],
  },
];

export const HOW_TO_SECTIONS: FAQSection[] = [
  {
    id: "when-to-use",
    title: "When to use Kiteframe",
    items: [
      {
        id: "use-when",
        question: "When should I use Kiteframe?",
        answer:
          "Use Kiteframe when you are unsure about sequence or scope, need cross-functional alignment, or want to explore alternatives before committing.",
      },
      {
        id: "avoid-when",
        question: "When should I avoid using Kiteframe?",
        answer:
          "Avoid Kiteframe when you are polishing final UI or need pixel-perfect outputs.",
      },
    ],
  },
  {
    id: "creating-workflow",
    title: "Creating your first workflow",
    items: [
      {
        id: "start-text-prompt",
        question: "How do I start from a text prompt?",
        answer:
          "Describe the process you want to model in plain language. Kiteframe will generate a baseline workflow proposal.",
      },
      {
        id: "start-scratch",
        question: "Can I start from scratch?",
        answer:
          "Yes. You can create an empty workflow and add nodes manually.",
      },
    ],
  },
  {
    id: "workflow-from-drawing",
    title: "Creating a workflow from a drawing",
    items: [
      {
        id: "upload-sketch",
        question: "How do I upload a sketch or diagram?",
        answer:
          "Upload a sketch, whiteboard photo, or diagram. Kiteframe can translate drawings into structured workflow proposals.",
      },
      {
        id: "how-interpreted",
        question: "How are drawings interpreted?",
        answer:
          "Kiteframe looks for ordering, directional cues, grouping, and branching. It does not assume visual hierarchy equals importance.",
      },
      {
        id: "interpretation-off",
        question: "What if interpretation feels off?",
        answer:
          "Add a short text prompt explaining intent rather than redrawing.",
      },
    ],
  },
  {
    id: "editing-structuring",
    title: "Editing and structuring",
    items: [
      {
        id: "nodes-neutral",
        question: "What do nodes represent?",
        answer:
          "Nodes are neutral. A node represents a step or concept, not necessarily a screen.",
      },
      {
        id: "connections-flow",
        question: "What do connections represent?",
        answer:
          "Edges indicate progression or relationship, not guarantees.",
      },
    ],
  },
  {
    id: "using-ai",
    title: "Using AI carefully",
    items: [
      {
        id: "ai-proposes",
        question: "How should I use AI suggestions?",
        answer:
          "AI proposes, you decide. Use AI to expand and explore, but apply changes intentionally.",
      },
      {
        id: "ai-best-practice",
        question: "What is the best practice for AI use?",
        answer:
          "Use AI to identify missing paths, then validate with your team.",
      },
    ],
  },
  {
    id: "review-handoff",
    title: "Review and handoff",
    items: [
      {
        id: "share-early",
        question: "When should I share workflows?",
        answer:
          "Share early. Kiteframe works best in early and mid-stage reviews, before decisions harden.",
      },
      {
        id: "export-alignment",
        question: "How do exports support handoff?",
        answer:
          "Exports support PRDs, design, and engineering discussions.",
      },
    ],
  },
];

export const SECURITY_SECTIONS: FAQSection[] = [
  {
    id: "data-ownership",
    title: "Data ownership",
    items: [
      {
        id: "who-owns",
        question: "Who owns my content?",
        answer:
          "You retain ownership of all workflows, uploaded content, and related artifacts created in Kiteframe.",
      },
    ],
  },
  {
    id: "data-usage",
    title: "Data usage",
    items: [
      {
        id: "how-used",
        question: "How is my data used?",
        answer:
          "Your data is used only to operate and improve the Kiteframe service. We do not sell customer data.",
      },
      {
        id: "ai-training",
        question: "Is my data used to train AI models?",
        answer:
          "No. Private customer data is not used to train AI models.",
      },
    ],
  },
  {
    id: "uploaded-images",
    title: "Uploaded images and drawings",
    items: [
      {
        id: "image-processing",
        question: "How are uploaded images handled?",
        answer:
          "Images uploaded for workflow generation are processed only to provide the requested feature. They are not used for model training.",
      },
    ],
  },
  {
    id: "data-retention",
    title: "Data retention",
    items: [
      {
        id: "retention-policy",
        question: "How long is my data retained?",
        answer:
          "Data is retained for as long as your account is active or as required to operate the service.",
      },
    ],
  },
  {
    id: "account-deletion",
    title: "Account deletion",
    items: [
      {
        id: "deletion-policy",
        question: "What happens when I delete my account?",
        answer:
          "When an account is deleted, associated data is removed according to Kiteframe's data retention policies.",
      },
    ],
  },
  {
    id: "encryption",
    title: "Encryption",
    items: [
      {
        id: "encryption-practices",
        question: "How is my data encrypted?",
        answer:
          "Data is encrypted in transit and at rest using industry-standard practices.",
      },
    ],
  },
  {
    id: "access-controls",
    title: "Access controls",
    items: [
      {
        id: "internal-access",
        question: "How is internal access managed?",
        answer:
          "Internal access follows least-privilege principles and is logged and reviewed.",
      },
    ],
  },
  {
    id: "subprocessors",
    title: "Subprocessors",
    items: [
      {
        id: "third-party",
        question: "Does Kiteframe use third-party services?",
        answer:
          "Kiteframe uses third-party infrastructure providers to operate the service.",
      },
    ],
  },
  {
    id: "responsible-disclosure",
    title: "Responsible disclosure",
    items: [
      {
        id: "report-security",
        question: "How do I report a security issue?",
        answer:
          "If you believe you have found a security issue, contact security@kiteframe.space. Reports are investigated promptly.",
      },
    ],
  },
];
