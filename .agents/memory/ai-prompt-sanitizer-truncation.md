---
name: Trusted system prompts vs the user-input sanitizer
description: Why AI silently ignores late-listed catalog entries, and how prompt trust must be modelled at the executor boundary.
---

**Rule 1 - trust travels in a function argument, never in the request body.** Any executor that public routes hand a client body to must take its trusted system prompt as a separate server-only parameter. Nothing in the body counts, and neither does a message's `role`.

**Why:** the chat and job routes forward the client request body wholesale. Two tempting shortcuts both fail: exempting `role === 'system'` from sanitization hands any caller an unfiltered system prompt, and moving the trusted prompt to a body field like `systemPrompt` just renames the same hole. A client must also never be able to occupy the provider's system channel at all - normalize incoming roles down to user/assistant before provider translation, rather than only sanitizing their text.

**Rule 2 - never HTML-escape an outbound prompt.** It goes to a model API and is never rendered as markup, so escaping buys no safety and corrupts structured payloads: it strips framing tags and rewrites `&` to `&amp;` inside JSON state. XSS belongs at the render/storage sink. Be careful asserting where that sink is - a response-sanitizer helper can exist and be imported but never actually called.

**Rule 3 - keep any outbound length cap above what route validation already accepts,** or content is silently truncated *after* validation passed.

**Diagnostic signature worth remembering:** a new palette component is wired into every registry, renders correctly, and passes unit *and* browser tests, yet the AI refuses to use it however explicitly you ask. That is not model preference - suspect the system prompt is being truncated. Entries near the front of the catalog keep working while later ones are invisible, which makes it look like a taste problem.

**How to apply:** measure the prompt actually sent rather than inferring from generated output, and remember that a prompt-path fix is not verifiable by unit tests alone - confirm with a live call that names the new capabilities and assert the model emits them.
