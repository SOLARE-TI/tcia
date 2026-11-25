# Script format (format 1)

A script is one JSON object saved as `<slug>.tcia.json`. The shape is fixed by `script.schema.json`; the ids come from `catalog.json`. Unknown fields are errors.

## Top level

| Key | Required | What it is |
|---|---|---|
| `tcia` | yes | Always `1`. |
| `meta` | yes | `title` (max 60 characters), `slug` (kebab-case, max 60: the output file name), `lang` (ISO 639-1, e.g. `es`, `en`, `pt`), `light` (default light id), `ui` (required when `lang` is not `es` or `en`). |
| `state` | no | 0-6 integer variables `{ "var": "bold", "initial": 0 }`, initial between -9 and 9. |
| `characters` | yes | 1-6 characters `{ id, name, kind, look? }`. `name` max 24 characters. |
| `sets` | yes | 1-8 settings `{ id, base, pieces? }`. |
| `scenes` | yes | The main column: 2-12 scenes, in story order. These are the user's scenes. |
| `decisions` | yes | 2-3 decisions `{ id, after, options }`. |
| `endings` | yes | 3-4 endings `{ id, title, when?, scenes }`. `title` (max 60) only appears in the report. |
| `notes` | no | `approximations` (`requested`, `used`, `reason`), `invented` (list of texts), `comment`. The engine ignores it. |

Ids you invent (characters, sets, scenes, decisions, options, endings, variables, items) are lowercase: a letter first, then letters, digits or `_`, at most 32 characters. Catalog ids are written exactly as in `catalog.json` (`pick_up`, `center_left`), never as an alias.

## Characters

```json
{ "id": "nico", "name": "Nico", "kind": "boy",
  "look": { "hair": "spiky", "accessory": "helmet", "accessory_color": "green" } }
```

`look` takes only the attributes of the kind's attribute set (`catalog.json > attributeSets`): `person` for the six human kinds, and `dog`, `cat`, `bird`. Missing attributes take the kind's `defaults`, then the attribute's `default`.

## Sets and pieces

```json
{ "id": "park", "base": "park", "pieces": [
  { "piece": "tree", "at": "far_left", "variant": "round" },
  { "piece": "ramp", "at": "center_right" },
  { "piece": "cloud", "at": "center", "layer": "sky" } ] }
```

- Without `pieces`, the base's `defaultPieces` are drawn. With `pieces` (even `[]`), only yours are.
- A piece: `piece`, `at` (an on-stage position), and optional `layer` (one of the piece's `layers`), `variant` (only if the piece has variants), `color` (only if `colorable`; a clothing palette color), `dx` (-120 to 120 px), `flip`.
- Pieces with `seat` (bench, sofa, chair, bed, rock, log, crate) seat a character who sits at the same position.

## Scenes

The same shape for main, branch and ending scenes:

```json
{ "id": "warmup", "set": "park", "light": "sunset",
  "cast": [ { "who": "nico", "at": "left", "facing": "right", "emotion": "happy" } ],
  "items": [ { "id": "ball", "item": "ball", "held_by": "nico" } ],
  "beats": [ ... ] }
```

- `light` is optional (default `meta.light`). `indoor` only works in a set whose base is `room`.
- `cast`: 1-4 members `{ who, at, facing?, posture?, emotion?, intensity? }`. `posture` is `standing` or `sitting`. Without `facing`, a character faces the center.
- `items`: 0-4 `{ id, item, at }` (on the ground, on stage) or `{ id, item, held_by }` (in someone's hand). Exactly one of `at` or `held_by`.
- `beats`: 1-24 beats. Each scene starts fresh from its own `cast` and `items`: nothing carries over between scenes.

## Beats

`{ actor, action?, variant?, to?, target?, item?, height?, emotion?, intensity?, say?, duration?, together? }`

- `action` is a catalog action; `variant` one of its variants (default `defaultVariant`).
- Without `action` it is a **reaction beat**: it needs `emotion` and only accepts `emotion`, `intensity`, `target` (who or where to look at), `duration` and `together`.
- Parameters follow the action's `params` (and the variant's, e.g. `jump.cartwheel` requires `to`, `point.up` forbids `target`):

| Action | Needs | Notes |
|---|---|---|
| `walk`, `run` | `to` | Any position, including off stage. |
| `jump` | (`to`, `height` optional) | `to` at most 3 marks away, never off stage. `height`: `low`, `mid` (default), `high`. |
| `wave`, `talk` | `talk` needs `say` | `target` is a character. |
| `point` | | `target` is a character or a position. |
| `sit` | | Sits on a seat at that position, or on the ground. |
| `pick_up` | `item` | The item lies at the actor's position; the actor holds nothing. |
| `give` | `target` | The actor holds something; the target holds nothing and stands or sits; `normal` needs distance 1, `toss` 1-3. |
| `fall` | | Leaves the actor lying. |
| `hug` | `target` | The target stands, at distance 1. |
| `think` | `say` | Thought balloon. |

- `emotion` and `intensity` (1-3, default 2) start with the beat and last until another beat of that character changes them, within the scene.
- `say` is the balloon: speech for every action except `think`, which draws a thought balloon.
- `together: true` starts the beat with the previous one. The first beat of a scene cannot be `together`.

## Stage rules (the validator simulates them)

- **Positions**: `offstage_left`, `far_left`, `left`, `center_left`, `center`, `center_right`, `right`, `far_right`, `offstage_right`. One mark is 240 px; the distance between two positions is the difference of their `order`.
- **Groups**: a beat without `together` opens a group; `together` beats join it. A group is checked against the state at its start. A character takes part in one beat per group (as actor, or as the target of `give` or `hug`); at most one balloon per group.
- **Occupancy**: at the start and after every group, no two characters share an on-stage position. Off-stage positions hold any number.
- **Off stage**: a character off stage can only `walk` or `run`, without `say`, and cannot be a target.
- **Moving**: `walk`/`run` need a `to` different from the current position. Moving leaves the character standing and facing where it went.
- **Posture**: if the current posture is not in the action's `startPostures`, the character stands up first (0.5 s). `sit` when already sitting is an error; `fall` leaves `lying`.
- **Items**: a character holds at most one item.

## Timing

- Reading time of a balloon: `clamp(0.9 + 0.055 * characters, 1.4, 6.0)` seconds.
- Beat base: `duration` if given (inside the action's `min`-`max`); `walk`/`run`: marks x `secondsPerMark` of the variant, clamped; `jump`: `1.1 + 0.25 * marks`, clamped to 0.7-3; reaction: 1.2 s; others: the variant's `defaultDuration` or the action's `duration.default`.
- Effective beat = max(base, reading time) + 0.5 if the character had to stand up. A group lasts as long as its longest beat. A scene = its groups + 0.8 s. A path = every scene shown + 0.8 s of fades each.

## Decisions, options and the join point

```json
{ "id": "d1", "after": "warmup", "options": [
  { "id": "flip", "label": "Go for the flip!", "effects": [ { "var": "bold", "add": 1 } ],
    "scenes": [ { "id": "flip_practice", ... } ], "rejoin": "the_jump" },
  { "id": "safe", "label": "Play it safe", "rejoin": "the_jump" } ] }
```

- `after` is a main scene; one decision per main scene; decisions listed in story order.
- `label` is the button text, max 32 characters.
- `effects`: 0-4 `{ var, add }` with `add` from -3 to 3, applied when the option is chosen.
- `scenes`: 0-2 branch scenes, played right after the choice.
- `rejoin` is always the main scene right after `after`, or `@endings` when `after` is the last main scene. Every main scene plays on every path.

## Endings and conditions

After the last main scene (and its branch), the endings are checked in order and the first whose `when` is true plays. Only the last ending may omit `when`.

```json
{ "choice": "d1", "is": "flip" }
{ "var": "bold", "op": ">=", "value": 2 }
{ "all": [ <condition>, ... ] }
{ "any": [ <condition>, ... ] }
{ "not": <condition> }
```

`op` is one of `==`, `!=`, `>=`, `<=`, `>`, `<`. Every combination of choices must reach an ending, and every ending must be the first true one for at least one combination.

## The contract example, commented

`example.tcia.json` is the smallest script that uses the whole format:

- 2 main scenes (`warmup`, `the_jump`) in one set (`park`, with its own pieces).
- Decision `d1` after `warmup`: option `flip` adds 1 to `bold` and plays the branch scene `flip_practice`; option `safe` has no branch. Both rejoin `the_jump`.
- Decision `d2` after the last main scene: both options rejoin `@endings`.
- Endings in order: `legend` (`all` of two `choice` conditions), `brave` (`var` condition), `buddies` (no `when`: everything else).
- `warmup`: Rocky starts holding the ball and gives it to Nico (distance 1). `end_legend`: Rocky jumps `together` with Nico's spin. `flip_practice`: Nico falls, then jumps, so he stands up first (+0.5 s). `end_buddies` changes the light to `sunset`.
- Durations: 16.855 s to 22.855 s over its 4 paths.
