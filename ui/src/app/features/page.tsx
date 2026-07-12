// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// On-domain mirror of docs/features.md (#509), rendered from the source markdown at
// build time. See utils/renderDocPage for the shared chrome and structured data.
import { buildDocMetadata, DocPageBody } from '../../utils/renderDocPage';

export const dynamic = 'force-static';

export const metadata = buildDocMetadata('features');

export default function Page() {
  return <DocPageBody slug="features" />;
}
