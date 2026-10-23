// What each tool draws before anyone types an address: the example business's
// service page, read as the tools read a page. Sample data on the reserved
// `.example` name, so no real site is ever shown as measured.
import { SPECIMEN_HERO_BUSINESS, SPECIMEN_HERO_DOMAIN } from "../../_landing/specimen";
import type { PageTags } from "./read";

export const EXAMPLE_CITY = "Austin";
export const EXAMPLE_BUSINESS = SPECIMEN_HERO_BUSINESS;

const PAGE_URL = `https://${SPECIMEN_HERO_DOMAIN}/water-heater-repair`;
const TITLE = `Water heater repair in ${EXAMPLE_CITY}, same day | ${SPECIMEN_HERO_BUSINESS}`;
const SHARED = `Tank and tankless water heater repair across ${EXAMPLE_CITY}.`;

/** The page as the meta tag preview reads it: no share picture and no X card. */
export const EXAMPLE_META: PageTags = {
  url: PAGE_URL,
  title: TITLE,
  description: `${SHARED} Upfront prices, licensed plumbers, same-day visits Monday to Saturday.`,
  h1: [`Water heater repair in ${EXAMPLE_CITY}`],
  canonical: PAGE_URL,
  noindex: false,
  schemaTypes: ["Plumber", "LocalBusiness"],
  share: {
    "og:title": `Water heater repair in ${EXAMPLE_CITY}, same day`,
    "og:description": SHARED,
    "og:site_name": SPECIMEN_HERO_BUSINESS,
  },
  phoneViewport: true,
  images: 9,
  imagesWithoutAlt: 2,
  lang: "en-US",
};

/** The page as the on-page check reads it: no text under the link, two images undescribed. */
export const EXAMPLE_ON_PAGE: PageTags = {
  ...EXAMPLE_META,
  description: "",
  share: { ...EXAMPLE_META.share, "og:image": `https://${SPECIMEN_HERO_DOMAIN}/card.png` },
};
