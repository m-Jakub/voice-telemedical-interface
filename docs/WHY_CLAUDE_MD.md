# Why my CLAUDE.md looks like this

I keep one base CLAUDE.md that I copy into every new repository. Stable rules are marked
[BASE]; the [PROJECT] section starts empty, and the agent's first job is to propose how to
fill it and which base rules do not fit. This way I keep the habits that work for me and
still adapt to each project instead of dragging irrelevant rules along.

This file is for humans. The agent does not need the reasoning, and CLAUDE.md is loaded in
every session, so keeping it short saves context.

## Polish and voice dictation
I think and decide fastest in Polish, and I dictate rather than type. Speaking, I describe
intent, constraints and doubts in much more detail than I would bother to type. Code and
technical artifacts stay in English. Dictation produces transcription errors (my tool
often turns "CLAUDE.md" into "Cloud MD"), so the agent interprets them from context and
asks only when an error could change the meaning of a decision.

## Weight markers (🟢 🟡 🔴)
Agents return walls of text with questions buried inside, all looking equally important.
I kept getting stuck on trivial questions: the answer seemed so obvious that I suspected a
hidden catch and reread everything to make sure I understood it. Now every question carries
a weight: 🟢 just confirm, 🟡 take a look, 🔴 think. I spend attention where it matters.

## Gates and "no silence as approval"
The agent proposes, I decide, and every phase ends with a stop. A point I skipped in a long
answer is not a point I approved. I want to own the decisions, not discover them in a diff.

## Shell rules
Agents liked writing commands with variables, subshells and `cd` chains. Permission allow
rules cannot match such commands, so each one needed my manual approval. The fix was explicit
rules: literal relative paths, one simple command per call.

## Git by explicit path
Agents create stray files. Staging only their own files by path (never `git add -A`) keeps
commits reviewable and keeps secrets and junk out of the history.

## Honesty about results
My research is about when LLM output should not be trusted (checking generated text against
its sources). The same principle applies to code: no invented API behaviour, no hiding
failures, and never changing a test just to make it pass.

## Explain-back
I must be able to explain every line, even when an agent wrote it. At the end of a feature I
explain each module in my own words and the agent corrects me.

## Models and subagents
Sonnet by default, Opus for design and hard decisions, Haiku for mechanical work, scripts
instead of extra model calls for checks. Subagents only when they earn their place: heavy
reading or an independent critic with a fresh context. A small project usually needs none.
