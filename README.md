# `cla-signatures` branch

This orphan branch is the storage location for the self-hosted CLA gate
(CLA Assistant Lite, configured in `.github/workflows/cla.yml` on `main`).

Contributor signatures are persisted to `signatures/version1/cla.json` by the
`contributor-assistant/github-action` workflow when a contributor signs the
[Contributor License Agreement](https://github.com/trebor/algebranch/blob/main/CLA.md).

**Do not protect this branch** — the CLA action must be able to push commits to
it. It intentionally shares no history with `main`.
