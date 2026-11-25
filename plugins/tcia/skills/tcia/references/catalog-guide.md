# Catalog guide

`catalog.json` is the only source of ids. It is closed: nothing outside it can be drawn or animated. It is long, so read only the sections you need.

## Sections

| Section | Use it for |
|---|---|
| `positions` | `at` and `to`: 9 positions, two of them off stage. |
| `lights` | `meta.light` and `scene.light`: `day`, `sunset`, `dusk`, `indoor` (indoor only in a `room`). |
| `kinds` | `characters[].kind`: `man`, `woman`, `boy`, `girl`, `old_man`, `old_woman`, `dog`, `cat`, `bird`. Each kind has its own `defaults`. |
| `attributeSets` | Which `look` keys a kind accepts and their values. A `palette` attribute takes the keys of that palette. |
| `palettes` | Colors: `clothing` (also for piece colors and bird plumage), `skin`, `hair`, `coat`. `materials` is internal. |
| `items` | Hand-held objects: ball, book, flower, letter, key, apple, gift, cup, map, phone. |
| `bases` | `sets[].base`: `city`, `forest`, `beach`, `mountain`, `park`, `countryside`, `room`, `plain`, with their default pieces. |
| `layers`, `pieces` | Scenery: 34 pieces, each with allowed `layers`, `variants`, `colorable` and `seat`. |
| `actions` | The 12 actions, their `params`, postures, durations and 34 variants. |
| `emotions` | The 6 emotions; each intensity 1-3 shows a face and effects. |
| `faces`, `effects` | Descriptions of what the engine draws for each emotion level. |
| `approximations` | What to use for things that are not in the catalog. |

## Mapping a request to ids

For every place, character, look, action, emotion, light and object the user mentions:

1. **Exact id.** If the word is an id (`walk`, `beach`), use it.
2. **Alias.** Every id has `aliases.es` and `aliases.en`. Normalize both sides (remove accents, lowercase, every character that is not a-z or 0-9 becomes a space, collapse spaces) and compare: "caminar", "andar" -> `walk`; "anochecer" -> `dusk`; "centro" -> `center`; "casco" -> `helmet`. Aliases are scoped: jump variants live under `actions.jump.variants`, hair colors under `palettes.hair`, piece variants under `pieces.<id>.variantAliases`.
3. **Approximation.** If the word is in an `approximations` entry of that category, use its `to` and keep its `note` in mind: "dance" -> `jump` with variant `spin`; "skateboard" -> `run` with variant `dash`; "horse" -> `dog` with `size: large`; "school" -> base `park`; "dawn" -> light `sunset`; "toy" -> item `ball`.
4. **Closest id.** Otherwise choose the closest id by meaning.

Write the id in the script, never the alias. Record every step 3 or 4 choice in `notes.approximations` as `{ "requested": "skateboard", "used": "run.dash", "reason": "..." }` and tell the user in the report.

## Acrobatics and moves

There are no extra actions: stunts are variants. Flip, backflip, spin, cartwheel and split are `jump` variants; a sprint is `run.dash`; a panicked run is `run.panic`; sneaking is `walk.sneak`; a proud walk is `walk.strut`; tossing is `give.toss`; a bear hug is `hug.bear`. Never invent a movement.

## Real beings only

People, dogs, cats and birds. A fantasy being, a robot or an object character (the `approximations` entry with `"fantasy": true`) is replaced by a real person or animal for the same role, and the user is told. If that being is central to the plot, ask the user before writing the script. Animals that are not dog, cat or bird follow their `approximations` entry (large four-legged -> large dog, small four-legged -> small cat, any bird -> bird); fish, insects, snakes and turtles have no stand-in: ask the user which catalog animal should play the role.

## Looks

- Give each character a few distinctive attributes (hair, outfit, one accessory, colors) and let the rest default.
- Defaults come from the kind first (`kinds.<kind>.defaults`), then from the attribute (`attributeSets.<set>.<attr>.default`).
- `bottom_color` is ignored with an outfit whose `usesBottomColor` is `false` (`dress`); the validator warns.
- Heights in px come from `kinds.<kind>.heightPx` (by `height` for people, by `size` for animals).
- Keep the same look for a recurring character across scenes: looks belong to the character, not to the scene.
