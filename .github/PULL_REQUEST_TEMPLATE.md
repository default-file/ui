## What changed

<!-- Describe the behavior change in one or two sentences. -->

## Why

<!-- The problem this solves. Link the issue if there is one. -->

## Screenshots

<!-- Before and after for any visual change. Delete this section otherwise. -->

## Checklist

- [ ] All new chrome resolves through design tokens or utilities. No raw hex,
      px, rem, or inline shadow values.
- [ ] Generators were run when their inputs changed (`npm run df:tokens`,
      `npm run df:registry`) and the output is committed.
- [ ] `npm run verify` passes locally.
- [ ] Semver bumped in `package.json` and `package-lock.json`, with a matching
      `CHANGELOG.md` entry, if this ships to consumers.
- [ ] No `TODO`, `FIXME`, or `HACK` left behind.
