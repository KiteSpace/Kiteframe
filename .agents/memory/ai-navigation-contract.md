---
name: AI navigation contract
description: Product boundaries for background AI work, navigation and verification.
---

Changing projects, changing side-panel tabs or collapsing a panel must not cancel submitted AI work. Cancellation belongs to explicit Stop or account/target lifecycle changes.

**Why:** Users reported having to re-initiate Generate Spec and Agent actions solely because they navigated away. Keeping heavy editor views mounted is not required to preserve the work.

**How to apply:** Keep submitted target identity and inputs independent of the visible editor. Reopening a view must not resubmit initial prompts or attachment analysis. Check intervening edits before saving an asynchronous result.

Session-level continuation is distinct from surviving refresh, browser closure, another device or a server restart.

**Why:** The approved navigation scope retained existing job-storage guarantees rather than requiring durable orchestration.

**How to apply:** Do not advertise refresh/restart recovery without implementing it separately. Unit tests of retained hooks do not substitute for signed-in browser checks of the complete flows.
