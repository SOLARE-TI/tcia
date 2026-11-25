# Final report

After `build.mjs --json` succeeds, report to the user in the language of the conversation. Use the template that matches it (Spanish or English); for other languages translate the English one. Fill it from the script, from `notes`, and from the validator's `stats` (`outcomes`, `secondsMin`, `secondsMax`). Keep it short: no explanation of how TCIA works.

What goes in, always:

1. Absolute paths of the HTML and of the script (from the builder's `html` and `script`).
2. How to open it: double-click the .html; it opens in a desktop browser, with no internet. Keys 1/2/3 choose, Enter starts.
3. Approximations (`notes.approximations`), or "none".
4. What you invented (`notes.invented`), or "nothing".
5. Decision map: decision -> options -> branch scenes -> join point.
6. Endings table: each ending, the combinations that reach it (`stats.outcomes`) and the shortest and longest duration of the story.
7. The gag of every scene, one line each: main, branch and ending scenes. Number beats from 1, in the order they appear in the scene: the validator's `/beats/0` is beat 1.
8. Warnings from the validator, if any.

## Spanish template

```markdown
**Listo: «<title>»**

- Animación: `<absolute path>.html` (ábrela con doble clic en un navegador de escritorio; funciona sin internet).
- Guion: `<absolute path>.tcia.json`
- Controles: Enter para empezar; 1, 2 o 3 para elegir.

**Aproximaciones:** <requested> -> <used> (<reason>); … | ninguna
**Lo que inventé:** <item>; … | nada

**Decisiones**
- <decision id> (después de «<main scene>»): <label 1> -> <branch scenes or "sin escena extra"> · <label 2> -> … ; vuelve en «<join point>»

**Finales**
| Final | Se ve con | Duración |
|---|---|---|
| <ending title> | <d1=…, d2=…>; <…> | <seconds> s |

Duración total: entre <secondsMin> y <secondsMax> s según las elecciones.

**El gag de cada escena**
- <scene id> (principal): <gag in a few words>, beat <n, desde 1>
- <scene id> (rama de <option>): <gag>, beat <n, desde 1>
- <scene id> (final <ending>): <gag>, beat <n, desde 1>
```

## English template

```markdown
**Done: "<title>"**

- Animation: `<absolute path>.html` (double-click it to open it in a desktop browser; it works offline).
- Script: `<absolute path>.tcia.json`
- Controls: Enter to start; 1, 2 or 3 to choose.

**Approximations:** <requested> -> <used> (<reason>); … | none
**What I invented:** <item>; … | nothing

**Decisions**
- <decision id> (after "<main scene>"): <label 1> -> <branch scenes or "no extra scene"> · <label 2> -> … ; rejoins at "<join point>"

**Endings**
| Ending | Reached with | Duration |
|---|---|---|
| <ending title> | <d1=…, d2=…>; <…> | <seconds> s |

Total length: <secondsMin> to <secondsMax> s depending on the choices.

**The gag of each scene**
- <scene id> (main): <gag in a few words>, beat <n, from 1>
- <scene id> (branch of <option>): <gag>, beat <n, from 1>
- <scene id> (ending <ending>): <gag>, beat <n, from 1>
```

If the validator still failed after 5 runs, there is no HTML: report the remaining errors (code, path, message) and what you tried, and ask the user how to proceed.
