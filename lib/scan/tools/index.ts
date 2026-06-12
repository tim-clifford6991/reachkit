import { registry } from "@/lib/tools/registry";
import { getListing } from "./get-listing";
import { getReviews } from "./get-reviews";
import { findCompetitors } from "./find-competitors";
import { searchWeb } from "./search-web";

export type { FactsExtras } from "./types";

// Register all four D-tools
registry.set("get_listing", getListing);
registry.set("get_reviews", getReviews);
registry.set("find_competitors", findCompetitors);
registry.set("search_web", searchWeb);

export { getListing, getReviews, findCompetitors, searchWeb };
