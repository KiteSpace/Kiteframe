# AI operations and navigation

Closing or switching a view is not cancellation. An operation retains its submitted
inputs and original target, while lightweight state is shared with a reopened view.
No editor or large panel needs to remain mounted.

| Entry point | Retained work and result | Persistence |
| --- | --- | --- |
| Project Spec generate/regenerate | Entire bounded section batch, waiting state, document and history | Original project document; immediate ordered save and baseline check under the row lock |
| Workflow Spec generate/regenerate, review, section update, suggestion, elaborate | Original workflow, review and section progress | Original workflow document; no partial-section chat replay |
| Overview AI fill/refine | Original project details and suggested refinement | Fill commits original project; refinement awaits explicit acceptance |
| KiteAI chat/workflow actions | Conversation, pending workflow draft and quick actions | Original conversation; workflow proposals still require user acceptance |
| Shared discussion | Read-only discussion and loading state | Existing separate discussion namespace, never the owner's private chat |
| Interface proposal/refinement | Plan, preview, conversation, errors and progress | Original proposal scope; selection/draft persistence beyond navigation is separate work |
| Interface generation | Approved inputs and original workflow; no focus stealing | New saved design and original project's transcript, even if another tab is active |
| Design Agent text/image changes | Original prompt, design, chat and progress | Compare-and-set original design; only its live editor updates |
| Node wireframe action | Original node and project | Existing captured project update callback |

The global progress control includes Stop, the origin link, and failure/retry.
Only explicit Stop, sign-out/account replacement or target deletion cancels work;
navigation does not call DELETE on provider jobs. Atomic saving disables Stop rather
than claiming that an already committed write can be cancelled.

Direct structured AI endpoints opt into existing owned jobs with X-AI-Background: 1.
Legacy callers retain their previous response contract. Middleware and credit rules
stay in place; structured jobs do not make an additional credit reservation.
Provider deadlines, planner deadlines, capacity limits and the Spec queue of two
remain bounded and unchanged.

Operation state is session-level. Browser refresh, a closed browser, another device
or a server restart are not durable orchestration guarantees. Completed proposal
selection persistence is a separate feature, not a navigation cancellation fix.
