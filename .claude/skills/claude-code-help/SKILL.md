---
name: claude-code-help
description: Answer a question about Claude Code (features, hooks, slash commands, skills, MCP servers, settings, permissions, IDE integrations, Agent SDK, Claude API) using the claude-code-guide agent and the official documentation. Use when the user asks how Claude Code works or how to do something with it. Ends with links to the references.
---

# Claude Code help

Answer the user's question about Claude Code from current official documentation, not from memory. Features and settings change often.

## Steps

1. **Take the question from the user's message.** If none was given, ask what they want to know.

2. **Run the `claude-code-guide` agent** via the Agent tool (`subagent_type: "claude-code-guide"`).
  - If a `claude-code-guide` agent was already run in this session, continue it with SendMessage instead of starting a new one.
  - Pass the user's question in full, plus any relevant context (Claude Code version, OS, what they already tried).
  - Tell the agent to search and fetch the official documentation (`docs.claude.com`, `code.claude.com/docs`, the Anthropic docs and the official GitHub repositories), to prefer these over any other source, and to return the URL of every page it used.

3. **Verify and fill gaps.** If the agent's answer is thin, vague, contradictory or may be outdated, search the official documentation yourself with WebSearch/WebFetch (a standard search first, an extended one only if needed). If the docs don't cover something, say so. Do not guess, and do not present a half-remembered flag or setting as fact.

4. **Answer the question** directly and concisely. Lead with the answer, then give exact commands, setting names or config snippets where useful.

5. **List the references** at the end under a `## References` heading: one markdown link per page actually used, with the page title as link text.
  - Only include URLs you or the agent actually fetched or saw in search results. Never invent or reconstruct URLs.
  - Prefer official documentation links. Mark any non-official source as such.

## Rules

- Read-only: do not change settings, files or configuration. Offer to make changes (for example with the `update-config` skill) after answering, and only do so if the user asks.
- This skill is general. Do not tie the answer to the current project unless the user's question is about it.