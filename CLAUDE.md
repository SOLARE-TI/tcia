# TCIA: guide for contributors

TCIA is a Claude Code skill (a plugin in `plugins/tcia/`) that turns a story idea into one self-contained .html animation.
Claude writes a JSON script; `scripts/validate.mjs` checks it and `scripts/build.mjs` injects it into a fixed engine (`assets/engine.html`).
This repository is also the plugin's marketplace (`.claude-plugin/marketplace.json`); only `plugins/tcia/` is installed for users.

## Fixed rules

- **Zero dependencies.** Only `node:*` modules. No `dependencies` in `package.json`, no `node_modules`, no lockfile, never `npm install`. Every JS file is `.mjs`.
- **Node.js 22 or newer** for everything: skill scripts, engine build and tests.
- **The contract does not change without a spec**: `plugins/tcia/skills/tcia/contract/` (catalog, schema, example) and `tests/repo/forbidden-terms.sha256.json`. A change there is a new spec and, in the same change, catalog, engine, validator, tests and examples.
- **`assets/engine.html` is generated** by `engine/build.mjs` from `engine/`. Never edit it by hand; commit it after `npm run build:engine`.
- **SKILL.md stays under 500 lines**; reference material goes in `references/`.
- **No names of existing works.** No file names an existing work or credits the style to one. Describe the style only in your own words: flat geometric cartoon, lowpoly with smooth silhouettes, well-joined parts and light faceting, no gradients, exaggerated action. `tests/repo/forbidden-terms.test.mjs` checks every file against hashed terms.
- **Comedy at all times**: every scene of every example has a gag; family humor, no real violence.
- **Tests never write inside the repository**: only under `os.tmpdir()`, and they clean up.
- Nothing personal or private in the repository: no local paths, data or secrets.

## Where to look

The full design is `specs/shared/2026-11-25/00_primera-version.md` ("this spec" below).

| If you're going to… | Read… |
|---|---|
| change how something is drawn or animated | this spec D13, `engine/src/`, `contract/catalog.json`, `tests/engine/` |
| change the validator or its messages | D10, `scripts/lib/`, `references/errors.md`, `tests/validator/` |
| change the builder or the engine placeholder | D11, D12, `tests/build/` |
| add an action variant, a piece, a kind or any catalog id | D6 ("Ampliar el catálogo"): write a spec first; then catalog, engine, validator, tests and examples in one change |
| change the script format | D7, D8, D9, `contract/script.schema.json`: new spec and a new `tcia` format number |
| edit what the skill tells Claude | D3, D4, `SKILL.md`, `references/` (including `references/comedy-guide.md`) |
| add or rebuild an example | D15, `examples/`, `npm run build:examples` |
| run the tests | D16 and the commands below |
| release a version | D20 |

Paths like `contract/`, `scripts/`, `references/` and `assets/` are inside `plugins/tcia/skills/tcia/`.

## Commands

```text
npm test                      # every test (node --test)
npm run test:engine           # engine logic, drawing and browser tests (Chrome or Chromium; set TCIA_CHROME if needed)
npm run test:validator        # contract, validator and builder
npm run test:examples         # the five examples: validity, coverage, comedy, engine agreement
npm run test:repo             # layout, docs, hygiene and forbidden terms
npm run build:engine          # regenerate assets/engine.html from engine/
npm run check:engine          # fail if assets/engine.html is out of date
npm run build:examples        # rebuild examples/*/*.html with the current engine
claude plugin validate .      # the marketplace
claude --plugin-dir ./plugins/tcia   # try the skill locally
```

Also `claude plugin validate ./plugins/tcia` for the plugin itself (add `--strict` before a release).

Validate or build one script by hand:

```text
node plugins/tcia/skills/tcia/scripts/validate.mjs <file.tcia.json> [--json]
node plugins/tcia/skills/tcia/scripts/build.mjs <file.tcia.json> [--out <folder>] [--json]
```

## Releasing

Bump `version` in `plugins/tcia/.claude-plugin/plugin.json` (and `package.json`) for every release; users only get changes when it changes. Tag `vX.Y.Z`. Publishing is done by the maintainers after the full test suite and `claude plugin validate --strict` pass.

Each release carries `tcia-skill.zip` for the Claude app (README, "Install"). Build it **outside the repository**, for example in a temporary folder, so it never lands in the tree: from `plugins/tcia/skills/`, run `zip -r <temporary folder>/tcia-skill.zip tcia/` (the archive's top folder must be `tcia/`), check it with `unzip -l <temporary folder>/tcia-skill.zip`, and upload it as an asset of the release.
