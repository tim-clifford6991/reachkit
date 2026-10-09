# Copy owed

`npm run copy:owed` writes `owed.md` here from the copy registry and the source tree. That file is gitignored: it is a worksheet, not a merge artifact.

Sentences go in `src/lib/presentation/copy/keys/`. A missing sentence is drafted and shipped, never `TODO(copy)` (owner ruling 2026-09-16, #759). `sendEmail` refuses a mail that contains the marker.
