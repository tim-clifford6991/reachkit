The synthetic route tree the cold-start and stopped-state sweeps run over
first. One clean route that must pass, and one route per rule carrying that
rule's own planted violation, so each rule is shown to discriminate before it
is run over `src/app` — where, today, it must flag nothing.

Deleting a rule leaves its planted violation unflagged and the fixture
describe fails by name. That is the whole point of the directory: a sweep
whose only subject is the product passes on the day it stops working.

These files are fixtures, not surfaces: they are outside `src/`, so the copy
registry's string-literal sweep does not enumerate them, and the sentences
below are deliberately not registry keys.
