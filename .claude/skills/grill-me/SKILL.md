---
name: grill-me
description: Grill the user with clarifying questions, one at a time, until the user says stop. Read-only; never changes any code.
disable-model-invocation: true
---

Grill the user on their current plan, design or idea. If none is given, ask what they want to stress-test.

Ask one question at a time and wait for the answer before asking the next. Continue until the user says stop.

- Probe assumptions, edge cases, trade-offs and contradictions, not just missing details.
- Ask each question as a multiple-choice question using the AskUserQuestion tool, with 2-4 distinct options. Put your recommended answer first and mark it "(Recommended)". The user can always pick "Other" to answer freely.
- If the codebase can answer a question, read the code instead of asking.

Read-only: do not edit, write or commit anything. Reading files is fine.

When the user says stop, summarize the decisions made and the open questions. Offer to write them down, and only do so after the user approves.
