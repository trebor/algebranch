# Gemini Rule Overrides

This file contains instructions specific to Google Antigravity / Gemini agents. These instructions override any conflicting rules in `AGENTS.md`.

## Accessibility Link Formatting Override
- The Antigravity CLI currently displays raw Markdown text and does not fold hyperlinks.
- To ensure screen reader accessibility, you MUST override the rule in `AGENTS.md` regarding Markdown links for issues, PRs, milestones, projects, and commits.
- You MUST refer to issues, PRs, commits, and milestones using ONLY their plain text names/numbers (e.g., "#123") without formatting them as Markdown links containing the HTTP URL.

## Copywriting and Style Guide (Strunk & White)
- Do NOT use parentheses `()` in user-facing copy, descriptions, tooltips, or announcements. Parentheses represent secondary thoughts and disrupt reader flow. Express all thoughts directly and cleanly.
