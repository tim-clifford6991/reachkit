import { registry } from "@/lib/tools/registry";
import { getListing } from "./get-listing";
import { getReviews } from "./get-reviews";
import { findCompetitors } from "./find-competitors";
import { searchWeb } from "./search-web";
import { searchKeywords } from "./search-keywords";
import { findCommunities } from "./find-communities";

export type { FactsExtras } from "./types";

// Register all D-tools
registry.set("get_listing", getListing);
registry.set("get_reviews", getReviews);
registry.set("find_competitors", findCompetitors);
registry.set("search_web", searchWeb);
registry.set("search_keywords", searchKeywords);
registry.set("find_communities", findCommunities);

export { getListing, getReviews, findCompetitors, searchWeb, searchKeywords, findCommunities };
