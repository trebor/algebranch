# Privacy for Schools

[User Guide](user-guide.md) • [Features Reference](features.md) • [Scope & Capabilities](scope.md) • [FAQ](faq.md) • [Documentation Index](index.md)

---

This page is for teachers, administrators, and district technology reviewers deciding whether Algebranch is safe to put in front of students. It states plainly what Algebranch collects and what it does not, and it maps that posture onto the questions school data-privacy reviews ask. Every claim here is verifiable against how the app is built.

This is a factual statement of our data posture. It is not legal advice, and it is not a compliance certification.

## The short version

Algebranch has no accounts, no sign-in, and no way for a student to enter personal information. The mathematics a student works on — the equations, the variable names, the step-by-step derivations — is processed entirely inside their own browser and is never uploaded. There is nothing for a student to fill in, and no profile is ever created. A class can start using it on Monday with nothing to provision, no roster to upload, and no data-processing agreement to negotiate.

## What we collect and what we never collect

| Data | Collected? | Notes |
| --- | --- | --- |
| Student name, email, or any account identity | **Never** | There are no accounts and no sign-in. There is no field in which to enter a name. |
| The equations, variable names, and derivation steps a student works on | **Never** | All parsing and solving happens locally in the browser. This content never leaves the device. |
| Saved workspaces and settings | **Stays on device** | Held in the browser's own local storage. We cannot read it, and it is never uploaded. |
| Cookieless aggregate traffic counts | **Always on** | Page views, referrer, country, and device type, recorded by our host with no cookies and no identifiers that can recognize a visitor. |
| Anonymous, aggregated usage events | **Opt-in only** | Which features get used, never the content of any equation. Disabled by default; runs only if a visitor explicitly opts in. |
| Crash error reports | **Automatic, content-free** | If the app itself crashes, a short technical report is sent so we can fix it. It carries no workspace content and nothing that identifies a user. The **Error reporting** section below has the details. |

## COPPA stance

The Children's Online Privacy Protection Act governs the collection of personal information from children under 13. If you are not familiar with it, the U.S. Federal Trade Commission enforces it and publishes [plain-language guidance on COPPA](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy). Algebranch collects no personal information from anyone, children included: there are no accounts, no sign-in, no names, no email addresses, and no persistent identifiers tied to a student.

The always-on baseline is our host's cookieless, aggregate traffic counting — page views, referrer, country, and device type — which sets no cookies and cannot recognize an individual visitor. Google Analytics runs only behind an explicit opt-in and is off by default; it is never enabled for a student who does not choose it. This wording is kept consistent with our full [Privacy Policy](https://algebranch.org/privacy).

## FERPA stance

The Family Educational Rights and Privacy Act governs education records held by schools. If you are not familiar with it, the U.S. Department of Education enforces it and runs the [Student Privacy Policy Office](https://studentprivacy.ed.gov/), which publishes guidance on FERPA. Algebranch creates no education records: it does not hold student names, grades, submissions, rosters, or any student work on our servers. A student's work lives only in their own browser and is never transmitted to us. Because there is no student record to hold, there is nothing for us to disclose, share, or retain.

## How shared links stay private

When a student shares their work, Algebranch defaults to a zero-knowledge short link such as `algebranch.org/s#…`. The browser encrypts the whole workspace before uploading, and our server stores only the encrypted bytes. The key that unlocks them is generated in the browser and travels in the link's fragment — the part after the `#` — which browsers never send to a server. We hold the ciphertext but never the key, so we cannot read a shared workspace; only someone who has the full link can. A student can also share a self-contained `?ws=` or `?eq=` link that carries the work inside the URL and uploads nothing at all. Either way, the mathematical content is never readable by us. Our [Privacy Policy](https://algebranch.org/privacy) has the full explanation.

## Error reporting

If the app crashes in a browser, it sends a small first-party error report so we can fix the problem. We chose a first-party report over a third-party crash-analytics service on purpose: nothing goes to anyone else's infrastructure. A report contains only the error message, the top line of its stack trace, the app version, and a coarse browser family such as "Safari Mobile". It never contains a student's equations or any workspace content, the page address, cookies, or anything that identifies a user; the parts of a web address where workspace data or a share key could live are stripped before the report is sent and again before it is logged.

## Questions

If a data-privacy review needs anything this page does not answer, reach us through our [GitHub repository](https://github.com/trebor/algebranch). We would rather answer a gatekeeper's question directly than have Algebranch quietly ruled out for lack of one.
