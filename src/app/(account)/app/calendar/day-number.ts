/** Where the site stands for a live page's search, as the weekly judgement
 *  recorded it. Both members are plain numbers: a standing that could not
 *  be measured is not a `PageStanding` at all — it is the absence of one,
 *  which a caller holds as `null`. */
export interface PageStanding {
  /** This week's place. */
  position: number;
  /** The place the previous recorded measurement held, or `null` where
   *  this is the first — a page measured once has a position and no
   *  change, and a change of `0` would claim it held still. */
  previous: number | null;
}

