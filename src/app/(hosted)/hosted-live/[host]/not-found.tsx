// The cached article's 404 (issue 1514). This route is static and cannot
// read the request's host, so it draws the empty answer of a host with no site.
import type React from "react";
import { HostedEmpty } from "../../hosted-page/[[...slug]]/gone";

export default function HostedLiveNotFound(): React.JSX.Element {
  return <HostedEmpty />;
}
