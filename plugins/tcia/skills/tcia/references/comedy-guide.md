# Comedy guide

TCIA animations are funny all the time. Every scene, main, branch and ending, has at least one gag. This guide translates classic cartoon gags into what the catalog offers. All ids below exist in `catalog.json`.

## Rules

- **One gag per scene, at least.** It can be physical, a reaction, or a line with a joke. Name it before building (workflow step 6).
- **Short, funny balloons.** 2-6 words when possible; the punchline goes last.
- **Sad and scared are comic too.** Use them as cartoon overreactions: tear streams (`sad` 3), knocking knees and hair standing up (`scared` 3), never real grief or terror.
- **Bad endings are funny.** The hero who fails ends dizzy, soaked, snoring or laughed at kindly, never punished, hurt or abandoned.
- **Family humor.** No cruelty, no mocking groups of people, nothing for adults only.
- **No real violence.** No weapons, no blows between characters, no injuries. Falls are bouncy and end with the character fine.

## Gag table

| Gag | Beats to write | What the engine shows |
|---|---|---|
| Fall and daze (physical) | `fall` with `trip`, `slip` or `faint`, then a short `talk` or `think` while lying | Squash on impact, dust, dizzy stars; `surprised` 2 adds `jump_back` and `jaw_drop` |
| Stunt that goes wrong (physical) | `jump` with `flip` or `backflip` and `height` `high`, then `fall` `trip` | Spin in the air, landing bounce, then the faceplant |
| Sudden stop (physical) | `run` with `dash` or `panic` and `to`, then a reaction beat | Speed lines and a skid; the stop sells the reaction |
| Flop (physical) | `sit` with `flop`, `emotion` `sad` or `happy` | The character drops and bounces |
| Big entrance (physical) | `run` `dash` from `offstage_left` to a position, then `jump` `split` | Speed lines, dust, a pose with arms up |
| Double take (reaction) | the event; a reaction beat (`emotion` `neutral` 1, `target`); another reaction beat (`surprised` 3, same `target`) | First a blank look, then `shocked` face, `jaw_drop`, `eyes_pop` |
| Take (reaction) | one reaction beat with `surprised` 2 or 3, or `scared` 3, right after the event | Anticipation and a stretch, then the face and effects |
| Slow burn (reaction) | reaction beats `angry` 1, then `angry` 2, then `angry` 3 on the same character | `annoyed` face, then `red_face` and `shake`, then `steam` |
| Tear stream (reaction) | reaction beat `sad` 3 over something tiny | `sob` face and `tear_streams` |
| Rule of three (line or physical) | three similar beats; the third breaks the pattern | Two clean `jump` beats and a third that ends in `fall` |
| Says one thing, does another (line) | `talk` "Easy peasy." then `fall` `slip` | The contrast is the joke |
| Deadpan answer (line) | a big event, then `talk` from a calm character (`neutral` 3) | Expressionless face against chaos |
| Wrong thing tossed (physical) | `give` with `toss` to a character, who then reacts `surprised` 3 | The item flies in an arc; the catch is the gag |
| Button at the end (any) | the last beat of the scene is a small gag after the main event | Leaves every scene on a laugh |

Effects listed come from `emotions.<emotion>.levels.<intensity>` in the catalog; dust, speed lines, skids and dizzy stars are drawn by the engine on its own.

## Examples in script format

Fall and daze, with the button at the end:

```json
{ "actor": "rulo", "action": "walk", "variant": "strut", "to": "center_right", "say": "Easy peasy." },
{ "actor": "rulo", "action": "fall", "variant": "slip", "emotion": "surprised", "intensity": 3 },
{ "actor": "rulo", "action": "talk", "say": "I meant to do that." }
```

Double take:

```json
{ "actor": "pepita", "action": "talk", "target": "rulo", "say": "Meow." },
{ "actor": "rulo", "target": "pepita", "emotion": "neutral", "intensity": 1 },
{ "actor": "rulo", "target": "pepita", "emotion": "surprised", "intensity": 3 }
```

Rule of three:

```json
{ "actor": "noa", "action": "jump", "variant": "split", "emotion": "happy", "intensity": 3 },
{ "actor": "iker", "action": "jump", "variant": "flip" },
{ "actor": "rocio", "action": "talk", "say": "Me too!" },
{ "actor": "rocio", "action": "fall", "variant": "trip", "emotion": "surprised", "intensity": 2 }
```

Slow burn ending on a deadpan line:

```json
{ "actor": "chema", "target": "rulo", "emotion": "angry", "intensity": 1 },
{ "actor": "chema", "target": "rulo", "emotion": "angry", "intensity": 2 },
{ "actor": "chema", "action": "talk", "variant": "shout", "say": "My cake!", "emotion": "angry", "intensity": 3 }
```

A "bad" ending that stays funny:

```json
{ "actor": "rulo", "action": "sit", "variant": "flop" },
{ "actor": "rulo", "action": "fall", "variant": "faint", "emotion": "happy", "intensity": 1 },
{ "actor": "rulo", "action": "think", "say": "Golden... jump... zzz" }
```

## Reviewing the gags

Before building, write down one line per scene: `<scene id>: <gag type>, beat <n>`, counting beats from 1 (the validator's `/beats/0` is beat 1). If a scene has no gag, add one from the table; usually a reaction beat after the main event is enough. Then validate again.
