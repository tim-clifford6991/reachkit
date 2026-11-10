import type React from "react";
import type { Metadata } from "next";
import { LegalPage } from "../_legal/LegalPage";
import { DPA } from "../_legal/documents";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.dpa);

export default function DpaPage(): React.JSX.Element {
  return <LegalPage document={DPA} />;
}
