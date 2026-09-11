# Structure Map — canonical repo layout

> Owned by the architect. This is the ONLY authority on where code lives.
> Implementers and planners place files per this map; the librarian flags any
> file on main that has no home here. New top-level directories require an ADR.
>
> A module may hold several BP nodes; a BP node lives in exactly one module.

## Top level

| Module / path | Responsibility (one sentence) | Owning BP nodes | Public entry points |
|---|---|---|---|
