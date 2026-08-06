---
name: claude-code-help
description: Answer questions about Claude Code, the Claude Agent SDK, the Claude API, or Claude Tag (Claude in Slack).
disable-model-invocation: true
---

Answer the user's question about Claude Code (or the Claude Agent SDK, Claude API, Claude Tag) by combining the
`claude-code-guide` agent with official documentation on the web, then cite what you used.

## Steps

1. Check whether there is already a running or recently completed `claude-code-guide` agent in this conversation that covers the question — if so, continue it via SendMessage instead of spawning a new one.
2. Otherwise, launch the `claude-code-guide` agent with the user's question, passed in full (it has `WebSearch` and `WebFetch` tools and knows how to research Claude Code/SDK/API/Tag topics).
3. Independently search the web for the same question against official documentation (e.g. docs.claude.com, Anthropic's own docs and changelog) to confirm or supplement the agent's answer, especially for anything version-specific or that could have changed recently.
4. Synthesize a direct answer to the user's question from both sources. Do not just relay the agent's raw output — reconcile it with what you found and resolve any discrepancies.
5. End the response with a "References" section listing the links actually consulted (from the agent's research and your own), so the user can verify or dig deeper.
