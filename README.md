# TCIA (Taller Creativo IA Animation)

## What it is

TCIA is a Claude Code skill that turns a story idea into **one self-contained .html file**: a 2D lowpoly cartoon animation with speech balloons and 2-3 interactive choices that lead to 3-4 endings. You give the plot, the scenes and the characters; Claude writes a short JSON script, a bundled validator checks it, and a fixed engine renders it. The look is a flat geometric cartoon: lowpoly characters and scenery with smooth silhouettes, well-joined limbs and light faceting, no gradients, moving with exaggerated, acrobatic action and comedy in every scene.

Leer en español: [README.es.md](README.es.md).

## Examples

`examples/` holds five stories. Each folder has the script (`<slug>.tcia.json`), the built animation (`<slug>.html`) and the request that produced it (`request.txt`). Open any `examples/*/*.html` with a double-click in a desktop browser; it works offline.

| Folder | Language | What it shows |
|---|---|---|
| `rulo-salta-la-ciudad` | Spanish | A daredevil kid, his sister and his dog in the city and the park: 5 scenes, 3 decisions, 4 endings |
| `rulo-and-the-mountain-race` | English | The same kid races a friend up a mountain: 4 scenes, 2 decisions, 3 endings |
| `test-people-actions` | Spanish | Test story: every person kind, action, variant, emotion and item |
| `test-animals-places` | English | Test story: dogs, cats and a bird in every place, light and scenery piece |
| `test-flow-max` | Portuguese | Test story: 12 scenes, 3 decisions with 3 options (27 paths), 4 endings |

## Install

```text
# inside Claude Code
/plugin marketplace add SOLARE-TI/tcia
/plugin install tcia@tcia

# or from the terminal
claude plugin marketplace add SOLARE-TI/tcia
claude plugin install tcia@tcia
```

TCIA works wherever Claude can run its Node.js scripts. Pick your place:

### Claude Code in the terminal

Use the commands above. Inside a session, `/plugin install tcia@tcia` opens the plugin's details: choose **Install for you** to have it in every project. The shell command installs for you (user scope) directly. Then type `/` and look for `/tcia:tcia`, or run `claude plugin list`.

- **Update.** Updates from this marketplace are not automatic unless you turn them on (`/plugin`, **Marketplaces** tab, select `tcia`). To update now, run `claude plugin update tcia@tcia`, or open `/plugin`, **Installed** tab, `tcia`, **Update now**.
- **Uninstall.** Run `claude plugin uninstall tcia@tcia`. To also forget the marketplace, run `claude plugin marketplace remove tcia` (it uninstalls its plugins too).

### Claude Code in the desktop app (Code tab)

The desktop app's local sessions read the same settings as the terminal, so if you installed TCIA in the terminal for you (user scope), it is already there. To install it from the app: in a local session, click **+** next to the prompt box and select **Add plugins** (or **Plugins**, then **Browse plugins**), select `tcia` and choose a scope. The plugin browser lists the plugins of the marketplaces you already added, so add `SOLARE-TI/tcia` first with `claude plugin marketplace add SOLARE-TI/tcia` in a terminal. To enable, disable or uninstall it later: **+**, **Plugins**, **Manage plugins**.

### Claude Code on the web (claude.ai/code)

Cloud sessions don't see plugins installed on your computer, and they don't add marketplaces listed in a repository's `.claude/settings.json`. Add TCIA to your claude.ai account instead:

1. Open [claude.ai/customize/plugins](https://claude.ai/customize/plugins).
2. Select **Add**, then **Add marketplace**, and enter `SOLARE-TI/tcia`.
3. Select the `tcia` plugin and add it.
4. Start a new cloud session.

Cloud environments come with Node.js 22 on the `PATH`.

### The Claude app (chat on claude.ai and in the desktop app)

**Not tested.** Everything in this section follows the official documentation, but nobody has tried it with TCIA yet: installing it as a plugin from **Customize**, the skill showing up in Cowork, uploading the .zip, and running it in chat.

Two ways, both from **Customize** in claude.ai or in the desktop app:

- **As a plugin (not tested)**: in **Customize > Plugins**, select **Add**, then **Add marketplace**, enter `SOLARE-TI/tcia`, then select `tcia` and add it. According to the documentation, the plugin is saved to your account, so its skill should also be available in Cowork and in Claude Code signed in to the same account.
- **As a skill file (not tested)**: download [tcia-skill.zip](https://github.com/SOLARE-TI/tcia/releases/latest/download/tcia-skill.zip) (a `tcia/` folder with `SKILL.md` inside). The link works once the `v0.1.0` release exists. In **Customize > Skills**, click **+**, then **Create skill**, then **Upload a skill**, choose the .zip and turn the skill on.

In chat, TCIA needs code execution: on individual plans, turn on **Code execution and file creation** (**Create and edit files** in the newer layout) under **Settings > Capabilities**; on Team and Enterprise plans an Owner enables it for the organization. It also needs Node.js 22 or newer inside that code-execution environment, and the documentation does not say which Node.js version it has: this is **not guaranteed and not tested**. If the validator cannot run there, use Claude Code.

## Use

Ask in plain words, in English or Spanish, or call `/tcia:tcia <idea>` in Claude Code (`/tcia` also works if no other command has that name). In chat, describe the story or type `/` and pick the `tcia` skill:

> Make an interactive animated story: Nico, a daredevil boy with a green helmet, and his dog Rocky. Scene 1: in the park, Nico sees a new ramp. Scene 2: at sunset, he tries the jump.

Claude asks one question only if something essential is missing (the plot, at least 2 scenes, the characters). It then writes `<slug>.tcia.json`, validates it, builds `<slug>.html` in your working folder and reports: where the files are, what it had to approximate, what it invented, the decision map, which choices lead to each ending, how long the story lasts and the gag of each scene.

## What you can ask for

- **Characters**: real beings only. Man, woman, boy, girl, old man, old woman (with height, build, skin, head shape, hair, outfit, colors and one accessory), dog, cat and bird. At most 6 per story.
- **Places**: city, forest, beach, mountain, park, countryside, a room, or an empty stage, dressed with 34 scenery pieces (trees, rocks, buildings, houses, lamps, benches, furniture, water, sand, clouds...).
- **Light**: day, sunset, dusk or indoor.
- **Actions**: walk, run, jump, wave, talk, point, sit, pick up, give, fall, hug and think, with 34 variants (flip, backflip, spin, cartwheel, split, sprint, tiptoe, toss, faint...).
- **Emotions**: happy, sad, angry, surprised, scared and neutral, at three intensities, always cartoonish: eyes that pop, jaws that drop, steam, tear streams.
- **Objects**: ball, book, flower, letter, key, apple, gift, cup, map and phone.

Anything outside this closed catalog is mapped to the closest thing and Claude tells you (a skateboard ride becomes a sprint, a horse becomes a large dog). Fantasy beings and robots are replaced by a real person or animal; if one is central to your story, Claude asks first.

## Limits

- Desktop browsers only: a 16:9 stage scaled to the window. No layout for phones or tablets.
- No audio, no narrator, no captions; characters speak and think in balloons.
- Fixed side camera: no pans, zooms or cuts inside a scene.
- Closed catalog: no new actions, kinds or pieces at request time.
- 2-12 main scenes (yours, never added or removed), 2-3 decisions with 2-3 options, 3-4 endings.
- Choices are remembered and decide the ending; branches always come back to the main story.

## Requirements

- Claude Code (terminal, desktop app or web), or the Claude app with code execution turned on.
- Node.js 22 or newer where Claude runs the scripts: on your PATH for Claude Code on your computer; cloud sessions already have it; for chat on claude.ai it is not guaranteed (see Install). The validator and the builder are Node scripts with zero dependencies.
- A desktop browser to watch the result.

## How it works

1. **Script.** Claude writes only a JSON script in a fixed format: characters, sets, scenes made of beats (who does what, where, with which emotion and balloon), decisions and endings.
2. **Validator.** `scripts/validate.mjs` checks the format, the catalog ids, the texts, the staging of every scene and every combination of choices, and explains each problem so Claude can fix it.
3. **Builder.** `scripts/build.mjs` injects the valid script into the engine and writes `<slug>.html` and `<slug>.tcia.json`.
4. **Engine.** A fixed HTML template with inline JavaScript and SVG that draws and animates the story. It never changes per story and needs no network.

## Contributing

Read [CLAUDE.md](CLAUDE.md): rules, where things live and how to run the tests.

## License

MIT, © 2026 Solare S.A.S. See [LICENSE](LICENSE).
