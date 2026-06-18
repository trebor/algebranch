# Security Policy

We take the security of Algebranch seriously and appreciate responsible
disclosure. Thank you for helping keep the project and its users safe.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests, or discussions.**

Instead, email **security@algebranch.org** with:

- a description of the vulnerability and its impact,
- the steps required to reproduce it (a share link, equation, or minimal
  example is ideal — see the `?eq=` deep links in the [README](README.md)),
- any relevant logs, screenshots, or proof-of-concept, and
- the affected version, browser, or environment.

You can also use GitHub's
[private vulnerability reporting](https://github.com/trebor/algebranch/security/advisories/new)
("Report a vulnerability" under the **Security** tab) if you prefer to keep the
report on GitHub.

## What to expect

- **Acknowledgement** within 7 business days.
- An initial assessment and a plan for a fix or mitigation, with a timeline we
  will share with you.
- Credit for your responsible disclosure once a fix has shipped, unless you
  prefer to remain anonymous.

Please give us a reasonable window to investigate and release a fix before any
public disclosure. We will keep you informed throughout.

## Scope

Algebranch is a client-side web application: the algebra engine runs entirely in
the browser and the app stores derivations in your browser's local storage. We
are most interested in reports covering:

- cross-site scripting (XSS) or injection via equation input, `?eq=`/`?ws=`
  deep links, or shared derivation payloads,
- integrity issues in the share-link encoding/decoding path, and
- exposure or corruption of locally stored workspace data.

## Supported versions

Security fixes are applied to the latest released version on `main`. We
recommend always running the most recent release.
