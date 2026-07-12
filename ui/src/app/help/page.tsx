// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The `/help` route (#514). The in-app Help modal is the in-context launcher; the
// canonical crawlable hub is `/docs`. So rather than stand up a competing hub (the
// duplication #514 set out to remove), `/help` is a permanent redirect to `/docs`
// — the URL is addressable and shareable, but there is one hub, not two. The
// crawlable shortcut content lives at its own route, `/shortcuts`.
import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

export default function HelpPage() {
  redirect('/docs');
}
