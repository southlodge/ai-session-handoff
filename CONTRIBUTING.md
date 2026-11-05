# Contributing

Thank you. Three rules keep the kit what it is:

1. **Node built-ins only.** No dependencies, no build step, no network calls. A user should be able to read the
   whole thing.
2. **Installers stay dry-run by default** and back up every file they change. If your change writes somewhere
   new, the dry run must list it.
3. **Every guard has a test that fails when the guard is removed.** Run both before you open a pull request:

   ```sh
   npm test          # 75 tests; uses a temporary home folder, never yours
   npm run mutate    # 103 mutations; every one must be KILLED
   ```

   If you add a guard, add a line to `mutate.mjs` that breaks it, and a test that notices.

The diagrams in `assets/diagrams/` are generated. To change one, edit its source in `assets/diagrams/src/`, run
`node assets/diagrams/src/build.mjs` and `node assets/diagrams/src/build.mjs --theme dark`, and commit the SVGs
with the source. Both builds must exit 0, and CI fails if the committed SVGs differ from a fresh build. The checks
are listed in `assets/diagrams/src/README.md`.

One change per pull request, with a sentence on what a user will see differently. British spelling in prose
(`licence`, `behaviour`); code identifiers as they are.

By contributing you agree that your contribution is licensed under the Apache License 2.0, like the rest of the
kit.
