# Validator errors

`validate.mjs --json` returns `{ ok, file, errors, warnings, stats }`. Each error has `code`, `path` (a JSON Pointer into the script, e.g. `/scenes/0/beats/2/to`), `message`, `suggestion` (an id, or null) and `approximation` (`{ to, note }`, or null). Fix the script at `path`; when `suggestion` is set it is usually the fix. Exit codes: 0 valid, 1 invalid, 2 usage or Node.

The checks run in phases: if the JSON or the schema is wrong, only those errors are reported; fix them and run again to see the rest.

## Input and shape

| Code | Cause | Fix |
|---|---|---|
| `E_USAGE` | Wrong arguments or the file cannot be read. | Pass one existing file: `validate.mjs <file> --json`. |
| `E_NODE_VERSION` | Node.js older than 22. | Tell the user to install Node.js 22 or newer and stop. |
| `E_JSON` | The file is not valid JSON. | Fix the syntax at the position in the message (trailing commas, missing quotes). |
| `E_FORMAT` | The root is not an object or `tcia` is not `1`. | Set `"tcia": 1`. |
| `E_SCHEMA` | A field is missing, unknown, of the wrong type, out of range or with the wrong format. | Follow the message. Unknown fields often have a `suggestion` (a typo). Catalog ids are lowercase ASCII ids: an alias with accents, spaces or capitals (`dragón`, `pick up`, `Caminar`) fails here, and the message adds the closest id or approximation; write that id. |
| `E_COUNT_SCENES` | Fewer than 2 or more than 12 main scenes. | Main scenes come from the user: ask them. Never add or remove main scenes. |
| `E_COUNT_DECISIONS` | Not 2 or 3 decisions. | Add or remove decisions. |
| `E_COUNT_OPTIONS` | A decision without 2 or 3 options. | Add or remove options. |
| `E_COUNT_ENDINGS` | Not 3 or 4 endings. | Add or merge endings. |

## Identity, references and catalog

| Code | Cause | Fix |
|---|---|---|
| `E_DUPLICATE_ID` | An id is used twice (characters, sets, all scenes together, decisions, options of a decision, endings, variables, items of a scene, cast members of a scene). | Rename the second one (the message says where the first is). |
| `E_ID_CLASH` | A character id equals a position id (e.g. `center`). | Rename the character. |
| `E_REF` | A reference points to nothing: a set, cast member, item, scene, variable, decision or option. | Use one of the known ids in the message; `suggestion` is the closest. |
| `E_CATALOG` | A value is not in the catalog. | Use `suggestion` (an alias or a typo), or apply `approximation.to` and record it in `notes.approximations`. For a fantasy being, propose a real one to the user. |
| `E_LOOK_KEY` | A `look` attribute the kind does not have (e.g. `hair` on a dog). | Remove it or use one of the listed attributes. |
| `E_PIECE` | A piece in a layer it does not allow, a variant on a piece without variants, a color on a piece that cannot be colored, or a piece off stage. | Follow the message: change the layer, drop the variant or color, or move the piece on stage. |
| `E_LIGHT_BASE` | `indoor` light in a set that is not a `room` (directly or through `meta.light`). | Use `day`, `sunset` or `dusk`, or a `room` set. |
| `E_UI_MISSING` | `meta.lang` is not `es` or `en` and there is no `meta.ui`. | Add `meta.ui` with `start`, `restart` and `decision` in that language. |

## Texts and balloons

| Code | Cause | Fix |
|---|---|---|
| `E_TEXT_LENGTH` | Title over 60, name over 24, label over 32, ending title over 60, or a `meta.ui` text over 32 characters. | Shorten it. |
| `E_TEXT_BLANK` | A text made only of spaces. | Write the text or remove the field. |
| `E_BALLOON_LENGTH` | A `say` over 80 characters. | Split it into two beats. |
| `E_BALLOON_WORD` | A word over 24 characters. | Use a shorter word or add spaces. |
| `E_BALLOON_LINES` | The balloon needs more than 4 lines of 24 characters. | Shorten it or split it. |

## Beats

| Code | Cause | Fix |
|---|---|---|
| `E_BEAT_EMPTY` | A beat with neither `action` nor `emotion`. | Add an action, or an emotion for a reaction beat. |
| `E_REACTION` | A reaction beat (no action) with `variant`, `to`, `item`, `height` or `say`. | Remove that field, or add an action (a line needs `talk` or `think`). |
| `E_PARAM` | A required parameter is missing (`walk` without `to`, `talk` without `say`, `jump.cartwheel` without `to`) or a forbidden one is present (`wave` with `height`, `point.up` with `target`). | Add or remove the parameter named in the message. |
| `E_DURATION` | `duration` outside the action's range (or 0.6-4 s for a reaction). | Use a value inside the range, or drop `duration`. |
| `E_TARGET` | The target is a position where only a character is allowed, or the actor targets itself. | Target another character. |

## Staging (simulation of each scene)

| Code | Cause | Fix |
|---|---|---|
| `E_POSITION_SHARED` | Two characters at the same on-stage position at the start or after a group. | Move one of them, or change the `to`. |
| `E_OFFSTAGE` | Someone off stage does anything but `walk`/`run` without `say`; or is a target; or a `jump` goes off stage. | Bring the character on stage first; use `walk`/`run` to exit. |
| `E_MOVE` | `walk`/`run`/`jump` to the current position, or a `jump` over more than 3 marks. | Pick another `to`, or use `run` for long distances. |
| `E_DISTANCE` | `give` or `hug` at the wrong distance (`give` 1, `give.toss` 1-3, `hug` 1). | Move the characters closer, or use `toss`. |
| `E_ITEM` | An item with both or neither of `at` and `held_by`; an item on the ground off stage; picking up while holding something; the item is not at the actor's position; giving with empty hands; giving to someone whose hands are full. | Follow the message; remember each character holds one item at most. |
| `E_POSTURE` | `sit` while sitting; giving to someone lying; hugging someone who is not standing. | Insert a move (which stands the character up) or change the order. |
| `E_TOGETHER` | The first beat of a scene is `together`; a character in two beats of one group; two balloons in one group. | Remove `together` or move one of the beats to its own group. |

## Story flow

| Code | Cause | Fix |
|---|---|---|
| `E_DECISION_AFTER` | A decision after a branch or ending scene, or two decisions after the same main scene. | Put each decision after a different main scene. |
| `E_DECISION_ORDER` | Decisions not listed in the order of their scenes. | Reorder the `decisions` list. |
| `E_REJOIN` | An option does not rejoin the main scene right after `after` (or `@endings` after the last one). | Use the expected id from the message. |
| `E_WHEN_MISSING` | An ending other than the last has no `when`. | Add a condition, or move that ending to the end. |
| `E_NO_ENDING` | Some combinations of choices reach no ending. | Remove `when` from the last ending or widen a condition. |
| `E_UNREACHABLE_ENDING` | An ending is never the first true one. | Narrow the earlier endings named in the message, or change this one's condition. |

## Warnings (the script still builds)

| Code | Cause | Fix |
|---|---|---|
| `W_UNUSED_CHARACTER` | A character appears in no scene. | Use it or remove it. |
| `W_UNUSED_SET` | A set is used by no scene. | Use it or remove it. |
| `W_UNUSED_VAR` | A variable that no option changes, or that no ending tests. | Add effects or conditions, or remove it. |
| `W_IGNORED_ATTR` | `bottom_color` with a one-piece outfit (`dress`). | Remove `bottom_color`. |
| `W_LONG_PATH` | A path longer than 360 s. | Shorten scenes or balloons. |

## Builder errors

| Code | Cause | Fix |
|---|---|---|
| `E_ENGINE_TEMPLATE`, `E_ENGINE_FORMAT` | The installed engine is broken or of another format. | Not your fault and not fixable by editing: tell the user to reinstall the plugin. |
