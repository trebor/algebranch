# Gemini Rule Overrides

This file contains instructions specific to Google Antigravity / Gemini agents. These instructions override any conflicting rules in `AGENTS.md`.

## Accessibility Link Formatting Override
- To prevent the terminal from displaying long HTTP URLs after issue links, you MUST format all links to issues, PRs, commits, milestones, and projects using the terminal-native **OSC 8 hyperlink escape sequence** rather than standard Markdown links.
- You must output the actual invisible `U+001B` (ESC) control byte (e.g., by generating the `\u001b` escape sequence in your output stream).
- **Important**: Do NOT output the literal text string `\u001b` (with backslash, u, 0, 0, 1, b) in your response, as the system's JSON serializer will double-escape the backslash (`\\u001b`), rendering it as raw text in the terminal. You MUST output the actual control character (the `0x1B` byte).
- **Important**: To compensate for the terminal link-parser's character-eating bug, you MUST pad the link text with exactly two spaces immediately after the link terminator (`\`).
- Format template:
  `ESC` `]` `8` `;` `;` `URL` `ESC` `\` `  ` `TEXT` `ESC` `]` `8` `;` `;` `ESC` `\`
  *Example*: `\u001b]8;;https://github.com/trebor/algebranch/issues/123\u001b\  #123\u001b]8;;\u001b\`

## Copywriting and Style Guide (Strunk & White)
- Do NOT use parentheses `()` in user-facing copy, descriptions, tooltips, or announcements. Parentheses represent secondary thoughts and disrupt reader flow. Express all thoughts directly and cleanly.
