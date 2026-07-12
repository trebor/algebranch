// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Server-side feeder for the in-app documentation modal (#514). It reads each
// help doc from docs/*.md at build time and renders it through the very same
// DocMarkdown the /<slug> route uses, then hands the pre-rendered bodies to the
// client DocModal. Because the render happens here (server, at build), no
// react-markdown ships to the browser, and the bodies stay unmounted until a doc
// is opened — so a crawler on a doc route never sees them duplicated. Mounted
// once in the root layout; the modal is toggled globally via activeHelpDocAtom.
import React from 'react';
import { getDocBody } from '../utils/renderDocPage';
import { HELP_DOC_SLUGS } from '../constants/docsPages';
import { DocMarkdown } from './DocMarkdown';
import { DocModal } from './DocModal';

export function DocModalHost() {
  const docs: Record<string, React.ReactNode> = Object.fromEntries(
    HELP_DOC_SLUGS.map((slug) => [slug, <DocMarkdown key={slug} markdown={getDocBody(slug)} />]),
  );
  return <DocModal docs={docs} />;
}
