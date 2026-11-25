---
name: tcia
description: 'TCIA (Taller Creativo IA Animation) turns a story idea into one self-contained .html file: a 2D lowpoly cartoon animation with speech balloons and 2-3 interactive choices that lead to 3-4 endings. Use it when the user asks, in English or Spanish, for an animation, an animated story, an interactive cartoon or a story with choices and endings, e.g. "create an animation", "make an animated story", "animate this story", "interactive story with choices", "lowpoly cartoon", "crea una animación", "haz una historia animada", "anima esta historia", "animación con decisiones", "historia interactiva con finales", "caricatura lowpoly". Claude writes only a JSON script; a bundled validator checks it and a fixed engine renders it. Desktop browsers only, no audio, real beings only.'
license: MIT
compatibility: Claude Code. Needs Node.js 22 or newer on PATH. The result opens in desktop browsers.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*)
---

# TCIA

## What this skill does

You turn the user's story into a script: one JSON file in the fixed TCIA format. A bundled validator checks it, and a bundled builder injects it into a fixed engine that renders the animation as a single offline .html file; you never write animation code.

## Hard rules

- Never write or edit HTML, JavaScript, CSS or SVG. Your only output file is the script (`<slug>.tcia.json`).
- Never edit anything under `${CLAUDE_SKILL_DIR}/assets/`, `${CLAUDE_SKILL_DIR}/contract/` or `${CLAUDE_SKILL_DIR}/scripts/`, not even to make a script pass.
- Main scenes belong to the user. Write exactly the main scenes the user gave, in their order. Never add or remove one. Branch scenes and ending scenes are yours to compose.
- Real beings only: people, dogs, cats and birds. No robots, dragons or any fantasy being.
- Use only ids from `${CLAUDE_SKILL_DIR}/contract/catalog.json`. When something is not in the catalog, use the closest id and record it in `notes.approximations`. Never invent an id or a movement.
- A balloon (`say`) has at most 80 characters, no word longer than 24 characters and at most 4 lines of 24.
- No narrator, no captions, no titles on screen. The only interface at the end is the "Start over" button; the engine draws it.
- Comedy at all times. Every scene (main, branch and ending) has at least one gag:
  - a physical gag: a fall, a flip, a spin, a sudden stop, a panic run;
  - an exaggerated reaction: a reaction beat at intensity 2 or 3 after the action, or a double take;
  - or a line with a joke.
- Balloons are short and funny. A "bad" ending is funny too: it ends on a gag, never on punishment, dread or plain sadness.
- Family humor: no cruelty, no real violence (no weapons, no blows between characters, no injuries), no mocking groups of people, nothing for adults only.

## Before you start

Only run these two commands: `${CLAUDE_SKILL_DIR}/scripts/validate.mjs` and `${CLAUDE_SKILL_DIR}/scripts/build.mjs`, exactly as written in the Workflow. Run nothing else in the shell: no `node --version`, no `node -e`, no `ls`, `cat` or `mkdir`. Read files with your file-reading tool and write the script with your file-writing tool.

`${CLAUDE_SKILL_DIR}` is the folder of this SKILL.md. If it is not replaced (for example in chat on claude.ai), the scripts are in `scripts/`, next to this SKILL.md, and the contract and references sit beside them in the same way: use those paths.

Both scripts check the Node.js version themselves. If one of them exits with code 2 and `E_NODE_VERSION`, or the shell says that `node` is not found, tell the user to install Node.js 22 or newer (https://nodejs.org) and stop.

## Inputs

Required from the user:

1. The plot.
2. At least 2 main scenes, each with a place and what happens there.
3. The characters, each with what they are (a girl, an old man, a dog...).

Optional (you fill them in when missing): looks, time of day, decisions, options, endings, output folder (default: the current working folder).

When something required is missing, ask **one** question that gathers everything missing, then wait. With fewer than 2 main scenes, ask for more scenes: never invent main scenes. Do not ask about optional things.

A fantasy being or a robot is not allowed: propose a real person or animal for the same role and tell the user. If that being is central to the plot, ask before writing the script.

## Workflow

1. **Gather the inputs.** Ask the single question only if something required is missing.
2. **Pick the language.** `meta.lang` is the language of the request unless the user asks for another one. `es` and `en` have built-in interface texts; for any other language write `meta.ui` (`start`, `restart`, `decision`) in that language. Balloons, labels and the title use `meta.lang`.
3. **Map to the catalog.** Read `${CLAUDE_SKILL_DIR}/contract/catalog.json` and `${CLAUDE_SKILL_DIR}/references/catalog-guide.md`. For each requested thing use: the exact id, else an id whose Spanish or English alias matches after normalization, else the matching `approximations` entry, else the closest id. Record every approximation in `notes.approximations` (`requested`, `used`, `reason`).
4. **Compose and write** `<folder>/<slug>.tcia.json`, following `${CLAUDE_SKILL_DIR}/references/script-format.md`, `${CLAUDE_SKILL_DIR}/references/story-craft.md` and `${CLAUDE_SKILL_DIR}/references/comedy-guide.md`:
   - the user's main scenes, in order;
   - 2 or 3 decisions (if the user gave none, place them at the moments of tension), each with 2 or 3 options;
   - 0 to 2 branch scenes per option;
   - 3 or 4 endings with conditions, all reachable;
   - everything you composed on your own listed in `notes.invented`.
5. **Validate and fix.** Run:

   ```
   node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs <file> --json
   ```

   Read every error (`code`, `path`, `message`, `suggestion`, `approximation`) and fix the script; `${CLAUDE_SKILL_DIR}/references/errors.md` explains each code. Repeat until `"ok": true`, at most 5 runs. If the fifth run still fails, stop and show the user the remaining errors. Never change the engine, the catalog or the scripts to make it pass.
6. **Review the gags.** Go through every scene, main, branch and ending, and name its gag (type and beat number, counting beats from 1: the validator's `/beats/0` is beat 1). If a scene has none, add one with `${CLAUDE_SKILL_DIR}/references/comedy-guide.md` and validate again (step 5). Also check that every balloon is short and funny and that no ending is dark.
7. **Build.** Run:

   ```
   node ${CLAUDE_SKILL_DIR}/scripts/build.mjs <file> --json
   ```

   Add `--out <folder>` when the user asked for another folder. On success it prints `{ "ok": true, "html": ..., "script": ..., "warnings": [...] }`.
8. **Report** to the user, in the user's language, following `${CLAUDE_SKILL_DIR}/references/report.md`.

## Files to read

| File | When |
|---|---|
| `${CLAUDE_SKILL_DIR}/contract/catalog.json` | Always, before mapping (step 3). It is long: read the sections you need. |
| `${CLAUDE_SKILL_DIR}/contract/script.schema.json` | When a field or its shape is unclear. |
| `${CLAUDE_SKILL_DIR}/contract/example.tcia.json` | Before writing your first script: a small valid script that uses every part of the format. |
| `${CLAUDE_SKILL_DIR}/references/script-format.md` | Before writing the script (step 4). |
| `${CLAUDE_SKILL_DIR}/references/catalog-guide.md` | When mapping the request to catalog ids (step 3). |
| `${CLAUDE_SKILL_DIR}/references/story-craft.md` | When designing decisions, branches, endings and staging (step 4). |
| `${CLAUDE_SKILL_DIR}/references/comedy-guide.md` | When writing beats and balloons (step 4) and when reviewing gags (step 6). |
| `${CLAUDE_SKILL_DIR}/references/errors.md` | When the validator reports an error (step 5). |
| `${CLAUDE_SKILL_DIR}/references/report.md` | Before the final report (step 8). |

The scripts are `${CLAUDE_SKILL_DIR}/scripts/validate.mjs` and `${CLAUDE_SKILL_DIR}/scripts/build.mjs`. Run them; do not read or change them. They are the only commands this skill runs.

## Report

Follow `${CLAUDE_SKILL_DIR}/references/report.md`: absolute paths of the HTML and the script, how to open it, approximations, what you invented, the decision map, the endings table with durations, and one line per scene naming its gag (beats counted from 1).
