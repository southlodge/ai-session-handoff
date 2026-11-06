## What a user will see differently

<!-- One or two sentences. One change per pull request. -->

## Checks

- [ ] `npm test` passes
- [ ] `npm run mutate` reports every mutation KILLED
- [ ] If this adds a guard: a line in `mutate.mjs` breaks it and a test notices
- [ ] If this changes a diagram: both builds exit 0 and the rebuilt SVGs are committed with the source
- [ ] No web pages, office documents or links to hosted Claude pages (the `no saved pages` check refuses them)
- [ ] Node built-ins only; no dependencies, no network calls
- [ ] Installers stay dry-run by default and list every file they would change
