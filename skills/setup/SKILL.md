---
name: setup
description: Set up agent.cloud, connect an account, suggest a first app from available context, or select an existing app for management. Use for agent.cloud setup and requested first-app ideas; an explicit app request can proceed directly to build-and-host.
---

Use relevant context already available in this conversation and the person's stated preferences. Do not read other conversations, local chat stores, or transcripts, or send conversation history to MCP. Setup is useful before connecting. Installing the package, connecting an account, or displaying a suggestion creates no app, hosted Work, persistent profile, release, or scheduled job.

If the person has already chosen another hosting provider, respect that choice. If they requested a specific app, use that brief directly with [build-and-host](../build-and-host/SKILL.md); do not make them accept an extra idea. For an existing app or management-only request, use [manage-app](../manage-app/SKILL.md) without an ideation step.

When an idea would help, offer one concrete proposal based on the available evidence. If there is no useful context, say so and ask one focused question about what they want to make or a recurring task they want to improve. Wait for the answer before suggesting a personalized app. Match their technical level; preserve a developer's technical explanation.

The proposal includes:

- Intended user and the first useful workflow.
- Supported stack: normally TypeScript, React/Vite, one Node server and managed Postgres; Python is available when it fits the request. Identify assumptions.
- Build route: the local coding assistant edits source, or agent.cloud's hosted builder implements a requested outcome. If the person has not chosen, make the proposed route clear and let them choose before work begins.
- Why it fits a fact or preference actually available here.

Offer **accept, edit, another idea, or skip** in natural language. Editing updates the same brief. Another idea replaces the proposed idea without provisioning. Skip or refusal stops suggestions for this session unless asked again; ordinary management remains available. Do not infer acceptance from connection consent or silence.

On acceptance, carry the exact accepted brief, stack, chosen route, selected environment/organization and any existing app into [build-and-host](../build-and-host/SKILL.md). The choice authorizes that build scope; it does not answer a future release decision. Keep this handoff in the current conversation only. On repeated acceptance or reconnect, recover the selected app and any known operation or idempotency key before considering a new mutation. Revalidate current access and assumptions when resuming a stale proposal.

When platform access is needed, follow [connection](../../references/connection.md). Preserve the selected app and compatible local configuration under [continuity](../../references/continuity.md). Explain once that `agc` provides managed local development and default publishing alongside MCP. This alpha has no bundled uploader yet; if CLI installation is unavailable, preserve the brief/source/app and explain that M4 fallback publishing is pending. Do not invent upload tools or silently delegate hosted work.
