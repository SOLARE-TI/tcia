# Story craft

How to turn the user's scenes into a story with choices that is clear, funny and always valid.

## The main column is the user's

Write the user's main scenes, in their order, with the places and events they described. Fill in the staging (positions, beats, balloons), but do not add, remove, merge or reorder main scenes. Everything else (decisions, branch scenes, endings) is composed around that column.

## Decisions

- 2 or 3 decisions, each after a different main scene, listed in story order. Put them at the moments of tension: right before a risk, a temptation or a choice between friends.
- 2 or 3 options each. Labels are short (max 32 characters), active and funny: "Go for the flip!", "Play it safe", "Hide behind Grandma".
- The overlay only shows the buttons. So end the scene before a decision with a **dilemma beat**: a `think` balloon or a line that states the choice ("Flip or no flip?"), or a character pointing at the two ways.
- A decision after the last main scene rejoins `@endings` and leads straight to an ending.

## Branches

- Each option may play 0 to 2 branch scenes right after the choice, then the story returns to the next main scene. Branches never skip or repeat main scenes.
- A branch shows the consequence of that choice: the practice flip, the shortcut, the mess. Keep them short (2-6 beats).
- An option with no branch is fine: its effect shows up later through the ending.

## Endings

- 3 or 4 endings, checked in order; the first whose `when` is true plays. Only the last one may omit `when`: make it the catch-all.
- Two ways to choose endings:
  - **choice table**: conditions on specific choices, e.g. `{ "all": [ { "choice": "d1", "is": "flip" }, { "choice": "d2", "is": "again" } ] }`;
  - **score**: options add to a variable (`effects`) and endings test it, e.g. `{ "var": "bold", "op": ">=", "value": 2 }`.
- Order matters: put the most specific ending first. The validator lists combinations that reach no ending and endings that never show.
- Every ending, including the "bad" ones, ends on a gag (see the comedy guide).

## Staging

- 4 to 10 beats per scene. Fewer feels empty; more drags.
- Start each scene with the cast already placed where the action needs them. Use off-stage positions to make entrances (`walk` or `run` in) and exits.
- Keep characters on different positions. Leave a free mark between characters who move a lot.
- **Anticipation**: before a big move, a beat that announces it (a shout, a crouching think, a point at the ramp).
- **Reactions**: after a big move, someone reacts with a reaction beat (no action, an `emotion` at intensity 2 or 3, a `target`). Reaction beats are cheap and very readable.
- **Intensities**: 1 is a hint, 2 is clear, 3 is cartoon-big (eyes pop, jaw drops, steam, tear streams). Use 3 for the peaks of the scene, not for every beat.
- **Acrobatics** are variants: `jump.flip`, `jump.backflip`, `jump.spin`, `jump.cartwheel`, `jump.split`, `run.dash`. Use `height: "high"` for the big moment.
- **together** lets two characters act at once (a jump while the other waves), with at most one balloon in the group.
- Use items for small plot devices: a ball tossed to a friend, a letter given, a cup snatched.

## Balloons

- One idea per balloon, short and with a twist. Up to 80 characters, words up to 24, 4 lines of 24. Prefer 2-6 words.
- Split a long line into two beats rather than shrinking the font of a thought.
- Write them in `meta.lang`. No narration: everything is said or thought by a character.
