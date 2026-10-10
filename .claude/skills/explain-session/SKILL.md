---
name: explain-session
description: Explain a part of the current Claude Code session by reading its JSONL transcript, then optionally build an interactive standalone HTML page about it. Use when the user wants to explore, understand or teach what happened in a session or conversation.
---

# Explain session

## Steps

1. **Ask which part to explore** (e.g. "the last prompt", "prompts 3-5", "the part about Docker"). If the user already said, skip the question.

2. **Extract that part.** The current transcript is the most recently modified file in `~/.claude/projects/<project-path-with-/-as->/*.jsonl`, e.g.:

   ```bash
   ls -t ~/.claude/projects/-Users-oscar-Projects-onboard/*.jsonl | head -1
   ```

   Locate the matching line range (`grep -n`), then copy it to a temp file in the scratchpad directory with `sed -n 'START,ENDp'`. Read the temp file, never the whole transcript.

3. **Explain in simple terms** what happened, then list interesting details as a **numbered list (1, 2, 3, ...)** so the user can refer to them. Look for things like: the `parentUuid` chain, models and advisor, token/cache usage, injected attachments (skills, tools, reminders), timestamps, permission mode, metadata lines.

4. **Ask one question** (AskUserQuestion, multi-select for details): should you create a standalone HTML file, and which numbered details should it include? Only build it on a yes.

## The HTML file

Single self-contained file (no external dependencies), saved in the working directory, opened with `open <file>` when done. It must:

- let the viewer navigate the JSONL lines interactively (list of records, pretty-printed JSON, parent/child links, trim very long fields);
- describe what happened in simple terms;
- include the chosen details.
