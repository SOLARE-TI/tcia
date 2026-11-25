# 00 · primera-version — TCIA 0.1.0: guion, validador, armador, motor y skill

| Repo(s) | `tcia` (nuevo; se publicará como `SOLARE-TI/tcia`, repo público). Sin pareja |
|---|---|
| **Módulo** | Todo el repo. Va en `specs/shared/` porque lo comparten los dos frentes de trabajo |
| **Plan aprobado** | 2026-11-25, más la ampliación bilingüe del mismo día (§1) |
| **Rama y base** | `main`, todavía sin commits. Base: el commit inicial con este spec y los archivos de contrato, que hace quien encarga. Trabajo en `feat/motor` y `feat/skill` (D19) |
| **Riesgo** | Medio. No toca producción ni datos, pero el motor es grande (12 acciones con 34 variantes en 3 esqueletos, 9 tipos de personaje, 34 piezas) y es lo que más puede atrasarse |
| **Orden** | Contrato (hecho) → motor y validador+skill en paralelo → integración (armar ejemplos) → auditoría → publicación, con aprobación expresa |
| **Pantalla hermana** | No aplica: proyecto nuevo |

---

## 1. Qué se pide · qué NO

### Plan aprobado (copiado del encargo, con los ajustes de redacción de la auditoría)

TCIA («Taller Creativo IA Animation») es una skill de Claude Code, open source y con licencia MIT, de
Solare S.A.S. Se publicará después en GitHub como `SOLARE-TI/tcia`, que será un repo público. Recibe
del usuario una trama, sus escenas y sus personajes, y entrega **un solo archivo .html** con una
animación 2D lowpoly y decisiones interactivas.

La forma de lograr que salga siempre igual: Claude nunca escribe código de animación. Escribe un
**guion** (JSON) en un formato fijo. Un **validador** (Node, sin dependencias) lo revisa, y un
**armador** lo inyecta en un **motor fijo** (una plantilla HTML con JS y SVG en línea, que viene
dentro de la skill y nunca se reescribe). El resultado es un .html autocontenido.

Decisiones ya aprobadas por el usuario:

- Nombre `tcia`. Skill para Claude Code, instalable como plugin desde el repo
  (`/plugin marketplace add SOLARE-TI/tcia` y luego instalar). Licencia MIT, titular «Solare S.A.S.», 2026.
- Idioma: instrucciones de la skill (SKILL.md y references) en inglés. README en inglés (`README.md`)
  y en español (`README.es.md`). Los textos de la animación (globos y botones) salen en el idioma en
  que se pide la historia: como mínimo `es` y `en`.
- Salida: un solo .html, sin red y sin dependencias externas. **Solo escritorio**: lienzo 16:9
  (viewBox 1920×1080) que se escala a la ventana con franjas, sin diseño para celular. Se revisa a
  1280 y 1920 px de ancho.
- Globos de diálogo (y de pensamiento para «pensar»). Sin narrador, sin subtítulos y sin audio.
- Las escenas las define el usuario. La skill no agrega ni quita escenas de la columna principal. El
  usuario da la trama y los detalles básicos de escenas y personajes, y la skill arma el resto.
- Estilo: caricatura geométrica y plana (cabezas y cuerpos hechos de formas geométricas simples y
  marcadas, como triángulos, rectángulos y círculos, con proporciones exageradas), construida con
  polígonos lowpoly de siluetas suaves: cada parte con un relleno plano y un facetado leve de como
  mucho 3 tonos, con el contraste que fija `FACET_CONTRAST`, sin degradados (anexo «Estilo afinado y
  fluidez»). Los movimientos son
  de acción exagerada, con mucha energía y acrobacias, aplastar y estirar (squash and stretch) y
  anticipación.
- Emociones exageradas y cómicas: ojos que se salen, mandíbula que cae, gotas de sudor, vapor de
  enojo, temblor, lágrimas en chorro, etc.
- Personajes: **solo seres reales**, nada de robots ni fantasía. Personas (hombre, mujer, niño, niña,
  anciano, anciana) con variantes de altura, complexión, piel, pelo, ropa y un accesorio. Animales:
  perro, gato y ave como mínimo. Lo que no esté en el catálogo se aproxima a lo más parecido, y la
  skill se lo avisa al usuario.
- Luces/paletas: día, atardecer, anochecer, interior.
- Escenarios: ciudad, bosque, playa, montaña, y otros que pida el usuario, armados con un catálogo
  cerrado de piezas (árboles, pinos, arbustos, rocas, edificios, casas, faroles, bancas, muebles,
  ventanas, puertas, agua, arena, colinas, nubes, etc.).
- Cámara fija de escenario 2D (vista lateral, tipo teatro). Sin paneos ni zoom.
- Catálogo cerrado de 12 acciones: caminar, correr, saltar, saludar, hablar, señalar, sentarse,
  recoger, entregar, caer, abrazar, pensar. Las acrobacias se expresan como variantes de esas
  acciones (por ejemplo, saltar con voltereta), no como acciones nuevas. 6 emociones: alegre, triste,
  enojado, sorprendido, asustado, neutral. Si se pide algo fuera del catálogo, se adapta a lo más
  parecido y se avisa; nunca se inventa un movimiento.
- Decisiones: cada historia tiene 2 o 3 momentos de decisión, cada uno con 2 o 3 botones. Sin límite
  de tiempo: la animación espera. **Las ramas siempre se vuelven a unir** a la columna principal.
  **Las elecciones se recuerdan** (estado) y determinan cuál de los **3 o 4 finales** se ve. Toda
  combinación de elecciones llega a un final, y cada final debe ser alcanzable. Al terminar, la única
  interfaz es el botón «Empezar de nuevo» / «Start over».
- Ejemplos: 2 historias originales con acrobacias de un chico temerario (personajes propios), y 3
  historias de prueba.

Ampliación aprobada el mismo día (bilingüe):

1. La `description` del frontmatter de SKILL.md debe activarse con pedidos en los dos idiomas.
   Incluye frases disparadoras en español («crea una animación», «haz una historia animada»,
   «animación con decisiones», «lowpoly»…) y sus equivalentes en inglés, respetando el límite de
   largo de `description`.
2. En el catálogo, cada id (acciones, variantes, emociones, tipos de personaje, luces, escenarios,
   piezas, posiciones) lleva sus alias en español y en inglés, para que la skill traduzca sin
   adivinar («caminar», «andar» → `walk`; «anochecer» → `dusk`). El validador usa esos alias para
   sugerir lo más parecido cuando algo no está en el catálogo.
3. Una de las 5 historias se pide en español y otra en inglés, y las dos validan y se arman.
4. SKILL.md y references siguen en inglés.

Anexo aprobado el mismo día: **comedia en todo momento**. Se formaliza tal cual; no cambian el
contrato (§6) ni el validador (D10). Criterios: A55–A65.

Motor:

1. Ninguna acción es lineal ni rígida. Todas llevan anticipación, exageración, rebote, asentamiento
   y aplastar y estirar.
2. Efectos cómicos secundarios: polvo, líneas de movimiento, rebote al aterrizar, estrellas o
   pajaritos tras «caer», derrape y temblor antes de un salto grande.
3. Reposo vivo: respiración con rebote, parpadeo, mirada y tics.
4. Las emociones son caricatura desde la intensidad 1. «Triste» y «asustado» también son cómicas.
5. Hay una pausa corta antes de cada reacción.
6. Las pantallas de decisión y de final tienen un toque juguetón, sin botones ni texto extra.
7. Nada de violencia real.

Skill:

1. Toda escena (principal, de rama y de final) tiene al menos un gag: físico, de reacción o una frase.
2. Los globos son cortos y con gracia. Los finales «malos» también son graciosos. Humor para toda la
   familia.
3. En `references/` va una guía de comedia en inglés que traduce los gags al catálogo.
4. El flujo repasa los gags antes de armar, y el informe al usuario nombra el gag de cada escena.
5. Los ejemplos y las historias de prueba cumplen la regla.

Para poder auditarlo: la guía es `references/comedy-guide.md` (de B; A1 la cuenta entre los archivos
de `references/`). La pausa antes de una reacción ocurre dentro de la duración del beat, así que D9 y
las cifras de A26 y A36 no cambian. Los efectos secundarios del motor se marcan en el SVG con
`g[data-fx]` (`dust`, `speed_lines`, `dizzy`, `skid`) y no son ids del catálogo.

Anexo de la auditoría del 2026-11-25: **Composición**. Criterios: A66–A71.

- **R1.** Los botones de decisión y de final nunca se cruzan con la caja de ningún personaje. Van en
  la franja superior o en la zona libre que calcule el motor.
- **R2.** Los globos eligen su posición entre varias candidatas, mirando a todos los personajes
  durante todo el beat. Nunca tapan una cabeza, y lo que crucen de un cuerpo queda bajo un tope que
  fija el motor y que la prueba documenta. La cola apunta a quien habla.
- **R3.** Los personajes van delante de las piezas del escenario; quien actúa en el beat va delante
  de los otros personajes; los efectos de un personaje no cruzan la cabeza de otro.
- **R4.** En las poses en el suelo, la cabeza y la cara se ven por encima del suelo y el pelo no lo
  atraviesa.
- **R5.** La pantalla de título muestra al reparto en fila, en reposo.
- **R6.** Todos los botones de una decisión tienen la misma altura.

Donde estas reglas chocan con D13.2 (orden de dibujo), D13.5 (posición del globo) o D13.6 (botones y
título), prevalecen las reglas. Lectura de R3: las piezas de la capa `front` se dibujan delante de
las de `back`, pero detrás de los personajes; la capa sigue en el catálogo. Lectura de R5: «el
reparto» son todos los personajes de `characters`, de pie, sobre el escenario de la primera escena
principal. Para poder auditarlo, el motor expone sus cajas: con `#tcia=stop:…`, `<html>` lleva
`data-tcia-boxes`, un JSON con `buttons` (cajas de los botones visibles, medidas en el DOM y pasadas
a coordenadas del viewBox) y `actors` (por cada personaje en escena: `id`, caja del cuerpo y caja de
la cabeza, en coordenadas del viewBox). En Node, las mismas cajas salen de los datos de dibujo.

Anexo del 2026-11-25: **Estilo afinado y fluidez**. Criterios: A72–A79.

1. **Uniones integradas.** Brazo, pierna, cuello, cola y patas son una sola forma continua, calculada
   desde el esqueleto en cada fotograma. Las uniones son redondeadas, la raíz de cada extremidad queda
   bajo el torso, la cabeza va unida por el cuello y no hay huecos ni escalones al doblar.
2. **Puntos que conectan.** Las piezas que se tocan comparten coordenadas exactas. Sin costuras entre
   facetas: relleno base de la silueta bajo las facetas, o un trazo del mismo color. Contornos con
   `stroke-linejoin` y `stroke-linecap` redondos.
3. **Menos facetado.** Siluetas más suaves, con más vértices o curvas. El contraste de facetas queda
   en una sola constante, `FACET_CONTRAST` (0 a 1). Siguen sin degradados. Esto reemplaza, donde
   choque, la descripción de «2 o 3 tonos facetados» (punto de estilo de este §1 y D13.2, ya
   ajustados).
4. **Mezcla entre beats y acciones** durante `BLEND_MS` (150–250 ms, lo fija el motor), con caras
   interpoladas.
5. **Continuidad:** a 60 fps, ninguna articulación avanza más de `MAX_JOINT_STEP_PX` entre fotogramas
   seguidos. Solo hay excepción en un cambio de escena, y el umbral se anota.
6. **Pies que no patinan** al caminar y correr: el pie apoyado tiene una velocidad horizontal bajo un
   tope documentado, y el paso va acompasado con la velocidad.
7. **A50 sigue igual:** menos de 12 ms por fotograma.
8. **Piernas en reposo:** en reposo y en la pantalla de título, piernas casi rectas, con cada rodilla
   en `MAX_REST_KNEE_DEG` o menos. Lo fija el motor, con un máximo de 36° (la pierna al 95 % de su
   largo), sin perder el rebote cómico. Al caminar, la rodilla de la pierna apoyada se queda en el
   tope durante todo el beat, incluidos el arranque y el final; el asentamiento dentro del beat se hace
   con el cuerpo, no doblando la pata apoyada. La pierna que avanza se dobla más. El tope rige durante
   el beat y en el reposo estable. Las únicas exclusiones son `scared` (su temblor de rodillas es un
   gag a propósito), `walk.sneak` (agachado a propósito), la anticipación explícita de un salto, el
   salto en el sitio al girar (`TURN_HOP_S`, lo exporta el motor: es un giro sin avanzar, no un paso)
   y el asentamiento de A55 en los ~0,25 s que siguen al fin de un beat de `walk` o `run`, que es el
   rebote cómico de llegada y puede pasar del tope por un instante (A78).
9. **Cola del globo:** mide como mucho `MAX_TAIL_PX`; si el globo sigue a quien habla, lo hace sin
   picos (A79).

Para que no choque con lo demás: la mezcla y la interpolación de caras ocurren dentro de la duración
de los beats, así que D9, A26 y A36 no cambian; en una reacción (A59) la mezcla no mueve la raíz
durante la pausa y la cara nueva empieza a interpolarse al terminar la pausa. Las cabezas, los torsos
y las piezas del escenario se siguen construyendo una vez por escena; las extremidades continuas se
recalculan en cada fotograma (D13.2). El motor exporta `FACET_CONTRAST`, `BLEND_MS`,
`MAX_JOINT_STEP_PX` y el tope de velocidad del pie apoyado; las pruebas los imprimen y el auditor
anota sus valores en §9.

### Qué NO entra en esta entrega

- Audio, narrador, subtítulos, cartelas de texto o títulos de final en pantalla.
- Diseño para celular o tableta. En una pantalla pequeña el lienzo se ve escalado, sin más.
- Movimientos de cámara (paneo, zoom, cortes dentro de una escena).
- Acciones, emociones, tipos de personaje o piezas fuera del catálogo; seres fantásticos o robots.
- Beats que cambian según el estado: el estado solo decide el final. Tampoco hay decisiones dentro
  de una rama, ramas que retroceden, ni ramas que se saltan escenas principales.
- Guardar el progreso entre recargas, editor visual, exportar a vídeo o GIF, idiomas de derecha a
  izquierda.
- CI en GitHub, GitHub Pages, publicación en el directorio de Anthropic, suite de `claude plugin eval`.
  Quedan como trabajo posterior.
- Publicar el repo: lo hace el usuario o quien él autorice, después de la auditoría (§7).

---

## 2. Diagnóstico

El repo es nuevo: solo tiene `git init -b main`, este spec y los archivos de contrato (§6). No hay
código que condicione la solución.

Lo que sí condiciona la solución es el formato vigente de Claude Code. Se verificó el 2026-11-25 en
la documentación oficial:

| Página | Qué se comprobó |
|---|---|
| https://code.claude.com/docs/en/skills | Una skill de plugin vive en `<plugin>/skills/<skill>/SKILL.md`. Todos los campos del frontmatter son opcionales; se recomienda `description`. El texto de `description` + `when_to_use` se corta a **1.536 caracteres** en el listado. Fuera de Claude Code (subidas a claude.ai) solo se admiten `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. `${CLAUDE_SKILL_DIR}` es la carpeta del SKILL.md y se sustituye en el cuerpo de la skill y en reglas `Bash(...)` de `allowed-tools`. Una skill de plugin se invoca como `/<plugin>:<skill>`, y también como `/<skill>` si no choca con otro comando. Recomienda SKILL.md de menos de 500 líneas y material de consulta en archivos aparte |
| https://code.claude.com/docs/en/plugins (hoy es una página general) y https://code.claude.com/docs/en/plugins/create | El manifiesto va en `.claude-plugin/plugin.json`; todo lo demás (`skills/`…) va en la raíz del plugin, nunca dentro de `.claude-plugin/`. Prueba local: `claude --plugin-dir <carpeta>`, `/reload-plugins`, `claude plugin validate <ruta>` (con `--strict` las advertencias fallan) |
| https://code.claude.com/docs/en/plugins/manifest-reference | En `plugin.json` solo `name` es obligatorio (kebab-case; no puede empezar por `claude-` ni `anthropic-`). Campos: `displayName`, `version`, `description`, `author` (`name` obligatorio, `email`, `url`), `homepage`, `repository`, `license`, `keywords`. Fijar `version` deja a los usuarios en esa versión hasta que cambie. **Un `CLAUDE.md` en la raíz del plugin no se carga y `claude plugin validate` advierte** |
| https://code.claude.com/docs/en/plugin-marketplaces (hoy muestra «Create a marketplace») y https://code.claude.com/docs/en/plugins/marketplace-reference | `.claude-plugin/marketplace.json` en la raíz del marketplace; obligatorios `name`, `owner` (con `name`) y `plugins`; cada entrada necesita `name` y `source`. Una ruta relativa debe empezar por `./` y se resuelve desde la raíz del marketplace (`"./"` o `"."` es la raíz misma). El nombre de la entrada debe ser igual al `name` del `plugin.json`. Si la entrada y el `plugin.json` declaran `version`, gana el `plugin.json` y `validate` advierte. Nombres reservados (no nos afectan: `tcia` es libre). Instalar: `/plugin marketplace add <owner>/<repo>` o `claude plugin marketplace add <owner>/<repo>`; luego `/plugin install <plugin>@<marketplace>` o `claude plugin install <plugin>@<marketplace>` |
| https://code.claude.com/docs/en/plugins/loading | Un plugin de ruta relativa de un marketplace en GitHub se copia a la caché del usuario; los archivos fuera de la carpeta del plugin no se copian. La página no dice que Claude Code ponga Node a disposición de los scripts de un plugin: el spec supone que no y lo exige aparte (D5) |

---

## 3. Decisiones

### D1 · Estructura del repo

El repo es a la vez **marketplace** (raíz) y contiene **un plugin** en `plugins/tcia/`. No se usa
`"source": "./"` (plugin en la raíz) por dos razones verificadas: el `CLAUDE.md` para contribuidores
que pide el encargo haría que `claude plugin validate` advierta, y la copia que recibe cada usuario
llevaría pruebas, specs y ejemplos que no necesita. El comando de instalación es el mismo.

```
tcia/
├── .claude-plugin/
│   └── marketplace.json                 # marketplace "tcia" → plugin ./plugins/tcia        (B)
├── plugins/
│   └── tcia/                            # RAÍZ DEL PLUGIN: lo único que se instala
│       ├── .claude-plugin/
│       │   └── plugin.json              #                                                   (B)
│       └── skills/
│           └── tcia/
│               ├── SKILL.md             # instrucciones de la skill, en inglés             (B)
│               ├── contract/            # CONTRATO: nadie lo edita sin spec nuevo        (nadie)
│               │   ├── catalog.json
│               │   ├── script.schema.json
│               │   └── example.tcia.json
│               ├── references/          # material de consulta, en inglés                 (B)
│               │   ├── script-format.md
│               │   ├── catalog-guide.md
│               │   ├── story-craft.md
│               │   ├── errors.md
│               │   └── report.md
│               ├── assets/
│               │   └── engine.html      # MOTOR FIJO, generado por engine/build.mjs        (A)
│               └── scripts/
│                   ├── validate.mjs     # CLI del validador                                (B)
│                   ├── build.mjs        # CLI del armador                                  (B)
│                   └── lib/             # módulos del validador y del armador              (B)
├── engine/                              # FUENTE del motor (no se instala)                  (A)
│   ├── build.mjs
│   ├── template.html
│   └── src/                             # módulos .mjs del motor
├── examples/                            # 5 historias: guion, HTML armado y pedido          (B)
│   ├── <slug>/{<slug>.tcia.json, <slug>.html, request.txt}
│   └── rebuild.mjs
├── tests/
│   ├── engine/                          #                                                   (A)
│   ├── contract/  validator/  build/  examples/  repo/                                   (B)
│   └── repo/forbidden-terms.sha256.json # lista de términos vetados (hashes)             (nadie)
├── specs/shared/2026-11-25/00_primera-version.md                                         (nadie)
├── CLAUDE.md          # guía para contribuir, en inglés                                     (B)
├── README.md          # inglés                                                              (B)
├── README.es.md       # español                                                             (B)
├── LICENSE            # MIT, «Copyright (c) 2026 Solare S.A.S.»                             (B)
├── .gitignore                                                                               (B)
└── package.json       # sin dependencias; solo scripts                                       (B)
```

(A) = ingeniero del MOTOR; (B) = ingeniero de VALIDADOR + SKILL + DOCUMENTACIÓN; (nadie) = contrato.
El reparto exacto está en D19. Nada de Solare dentro: ni rutas de un equipo, ni datos, ni secretos;
lo único que aparece es el titular de la licencia y el autor del plugin.

### D2 · Plugin, marketplace e instalación

`plugins/tcia/.claude-plugin/plugin.json`, exactamente:

```json
{
  "name": "tcia",
  "displayName": "TCIA (Taller Creativo IA Animation)",
  "version": "0.1.0",
  "description": "Interactive 2D lowpoly cartoon animations from a story idea: Claude writes a JSON script, a validator checks it and a fixed engine turns it into one self-contained HTML file.",
  "author": { "name": "Solare S.A.S.", "url": "https://github.com/SOLARE-TI" },
  "homepage": "https://github.com/SOLARE-TI/tcia",
  "repository": "https://github.com/SOLARE-TI/tcia",
  "license": "MIT",
  "keywords": ["animation", "interactive-story", "lowpoly", "svg", "storytelling", "animacion", "historia-interactiva"]
}
```

`.claude-plugin/marketplace.json`, exactamente:

```json
{
  "name": "tcia",
  "description": "TCIA: a Claude Code skill that turns a story idea into an interactive lowpoly animation.",
  "owner": { "name": "Solare S.A.S.", "url": "https://github.com/SOLARE-TI" },
  "plugins": [
    {
      "name": "tcia",
      "source": "./plugins/tcia",
      "description": "Story idea in, one interactive lowpoly animation (.html) out.",
      "category": "creative",
      "tags": ["animation", "storytelling", "lowpoly"]
    }
  ]
}
```

La versión vive solo en `plugin.json` (si también estuviera en la entrada, `validate` advierte).

Instalación (va literal en los dos README):

```text
# dentro de Claude Code
/plugin marketplace add SOLARE-TI/tcia
/plugin install tcia@tcia

# o desde la terminal
claude plugin marketplace add SOLARE-TI/tcia
claude plugin install tcia@tcia
```

Uso: pedirlo en lenguaje natural («crea una animación…») o invocar `/tcia:tcia <idea>`; `/tcia`
también sirve si ningún otro comando se llama así. Desarrollo local: `claude --plugin-dir ./plugins/tcia`,
`claude plugin validate .` (marketplace) y `claude plugin validate ./plugins/tcia` (plugin y skill).

### D3 · SKILL.md

Frontmatter exacto (solo claves que también acepta claude.ai, por si se sube allí):

```yaml
---
name: tcia
description: 'TCIA (Taller Creativo IA Animation) turns a story idea into one self-contained .html file: a 2D lowpoly cartoon animation with speech balloons and 2-3 interactive choices that lead to 3-4 endings. Use it when the user asks, in English or Spanish, for an animation, an animated story, an interactive cartoon or a story with choices and endings, e.g. "create an animation", "make an animated story", "animate this story", "interactive story with choices", "lowpoly cartoon", "crea una animación", "haz una historia animada", "anima esta historia", "animación con decisiones", "historia interactiva con finales", "caricatura lowpoly". Claude writes only a JSON script; a bundled validator checks it and a fixed engine renders it. Desktop browsers only, no audio, real beings only.'
license: MIT
compatibility: Claude Code. Needs Node.js 22 or newer on PATH. The result opens in desktop browsers.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*)
---
```

La `description` mide 777 caracteres (límite 1.536, sin `when_to_use`), tiene 5 disparadores en
inglés y 6 en español, y va entre comillas simples de YAML (no contiene apóstrofos). Si se cambia,
la prueba de A8 vuelve a medirla.

Cuerpo (inglés, menos de 500 líneas, directo: qué hacer, no por qué). Secciones en este orden:

1. **What this skill does** — dos frases: escribe un guion JSON y nunca código de animación.
2. **Hard rules** — nunca escribir ni editar HTML, JS, CSS o SVG; nunca editar `assets/`,
   `contract/` ni `scripts/`; no añadir ni quitar escenas principales; solo seres reales; solo ids
   del catálogo; globos de 80 caracteres como máximo; la interfaz final es solo «Start over».
3. **Before you start** — no se corre ningún comando previo (nada de `node --version` ni `node -e`).
   Las únicas órdenes de terminal de la skill son `validate.mjs` y `build.mjs` (punto 5), que
   comprueban ellas mismas la versión de Node: si una sale con código 2 y `E_NODE_VERSION` (o si
   `node` no existe), Claude le dice al usuario que instale Node.js 22 o más nuevo y para.
4. **Inputs** — qué es obligatorio y cuándo preguntar (D4).
5. **Workflow** — los pasos de D4, con los comandos exactos:
   `node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs <file> --json` y
   `node ${CLAUDE_SKILL_DIR}/scripts/build.mjs <file> --json`.
6. **Files to read** — rutas con `${CLAUDE_SKILL_DIR}` a `contract/catalog.json`,
   `contract/script.schema.json`, `contract/example.tcia.json` y a cada archivo de `references/`,
   diciendo cuándo leer cada uno. (La sustitución de `${CLAUDE_SKILL_DIR}` solo ocurre en SKILL.md:
   por eso todas las rutas que Claude necesita están aquí y no en `references/`.)
7. **Report** — remite a `references/report.md`.

`references/` (inglés):

| Archivo | Contenido |
|---|---|
| `script-format.md` | El guion campo por campo (D7), la simulación del escenario (D8), los tiempos (D9), las condiciones, con el ejemplo del contrato comentado |
| `catalog-guide.md` | Cómo leer `catalog.json`, cómo mapear lo pedido (alias es/en, aproximaciones), política de seres fantásticos, valores por defecto del aspecto |
| `story-craft.md` | Cómo diseñar 2–3 decisiones, ramas y 3–4 finales con condiciones (tabla de elecciones o puntaje), el beat de dilema antes de cada decisión (la superposición solo muestra botones), puesta en escena cómica: anticipación, reacciones, intensidades, acrobacias como variantes, 4–10 beats por escena |
| `errors.md` | Cada código del validador (D10) con su causa y cómo corregirlo |
| `report.md` | Plantilla del informe final en español y en inglés (D4, paso 7) |

### D4 · Flujo de la skill

1. **Node.** Sin paso previo: la primera orden de terminal es `validate.mjs` (paso 6), que comprueba
   la versión. Si `validate.mjs` o `build.mjs` salen con código 2 y `E_NODE_VERSION` (o `node` no
   existe), informar al usuario qué instalar y parar.
2. **Reunir datos.** Obligatorios: la trama; al menos 2 escenas principales, cada una con lugar y qué
   pasa; los personajes con su tipo. Opcionales (la skill los completa): aspecto, hora del día,
   decisiones, opciones, finales, carpeta de salida (por defecto, la carpeta de trabajo). Si falta
   algo obligatorio, **una sola pregunta** que junte todo lo que falta. Con menos de 2 escenas se
   pregunta; nunca se inventan escenas principales.
3. **Idioma.** `meta.lang` = idioma del pedido, salvo que el usuario diga otro. `es` y `en` tienen
   textos de interfaz en el catálogo; para otro idioma la skill escribe `meta.ui` traducido.
4. **Mapear al catálogo.** Leer `contract/catalog.json`. Para cada cosa pedida: id exacto, o alias
   (es/en) normalizado, o entrada de `approximations`, o lo más parecido. Toda aproximación se anota
   en `notes.approximations` (`requested`, `used`, `reason`). Un ser fantástico o un robot no entra:
   se propone un ser real; si es central en la trama, se pregunta antes de seguir.
5. **Componer y escribir** `<carpeta>/<slug>.tcia.json`: escenas principales del usuario en su orden;
   2–3 decisiones (si el usuario no las dio, la skill las propone en los momentos de tensión); ramas
   de 0–2 escenas por opción; 3–4 finales con condiciones. Lo que la skill compuso por su cuenta va en
   `notes.invented`.
6. **Validar y corregir** con `validate.mjs --json` hasta `"ok": true`, como máximo 5 vueltas. Si en
   la quinta sigue fallando, parar y mostrar al usuario los errores que quedan. Nunca se edita el
   motor, el catálogo ni los scripts para que pase.
7. **Armar** con `build.mjs --json` e **informar** (en el idioma del usuario): ruta absoluta del
   HTML y del guion; cómo abrirlo (doble clic, navegador de escritorio); aproximaciones; lo que la
   skill inventó; mapa de decisiones (decisión → opciones → escenas de rama → punto de unión); tabla
   de finales con las combinaciones que llevan a cada uno (de `stats.outcomes`); duración mínima y
   máxima. En el informe, los beats se numeran desde 1: el beat 0 de un mensaje del validador es el
   beat 1 del informe.

Pedidos de prueba para A51–A54 (se guardan como texto en `tests/repo/fixtures/prompts/`, de B):

- **es-completo**: «Crea una animación con decisiones: Tomás, un niño temerario con casco verde, y su
  perra Luna. Escena 1: en el parque, Tomás ve una rampa nueva. Escena 2: en la calle, al atardecer,
  intenta un salto. Escena 3: de noche, en casa, se lo cuenta a su abuela.»
- **en-fantasia**: «Make an interactive animated story: a girl named Ivy and her pet dragon visit the
  beach (scene 1), then a forest (scene 2). She carries a skateboard.»
- **es-una-escena**: «Haz una historia animada de un gato que se cae de un árbol.»
- **activación**: «haz una historia animada con decisiones sobre dos amigos en la playa» y
  «make an interactive animated story about two friends at the beach».

### D5 · Requisito de Node y cero dependencias

- **Node.js 22 o más nuevo** para todo (scripts de la skill, build del motor, pruebas). Node 20 ya
  no tiene soporte; 22 permite patrones glob en `node --test`.
- `validate.mjs`, `build.mjs` y `engine/build.mjs` comprueban la versión al arrancar y, si es menor,
  salen con código 2 y el mensaje `TCIA needs Node.js 22 or newer (found <version>).`
- **Cero dependencias de npm**: solo módulos `node:*`. `package.json` no tiene `dependencies`,
  `devDependencies`, `peerDependencies` ni `optionalDependencies`; no hay `node_modules` ni lockfile.
  Todo archivo JS del repo es `.mjs`. No se usa `npm install` en ningún paso.

`package.json`, exactamente:

```json
{
  "name": "tcia",
  "version": "0.1.0",
  "private": true,
  "description": "TCIA: a Claude Code skill that turns a story idea into an interactive lowpoly animation.",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test",
    "test:engine": "node --test \"tests/engine/**/*.test.mjs\"",
    "test:validator": "node --test \"tests/contract/**/*.test.mjs\" \"tests/validator/**/*.test.mjs\" \"tests/build/**/*.test.mjs\"",
    "test:examples": "node --test \"tests/examples/**/*.test.mjs\"",
    "test:repo": "node --test \"tests/repo/**/*.test.mjs\"",
    "build:engine": "node engine/build.mjs",
    "check:engine": "node engine/build.mjs --check",
    "build:examples": "node examples/rebuild.mjs"
  }
}
```

### D6 · Catálogo cerrado (`contract/catalog.json`)

Es la única fuente de ids. Lo leen el motor (para dibujar), el validador (para comprobar y sugerir)
y la skill (para mapear lo pedido). Contenido:

| Sección | Qué fija |
|---|---|
| `stage` | viewBox 1920×1080, suelo en y=900, horizonte en y=640, 240 px entre marcas, escala y desvanecido de la capa lejana, color de tinta y grosor de contorno |
| `timing` | levantarse 0,5 s, fundido de escena 0,4 s, cola de escena 0,8 s, espera antes de decidir 0,3 s, beat de reacción, tiempo de lectura, respiración y parpadeo |
| `text` | globo ≤ 80 caracteres, 24 por línea, ≤ 4 líneas; botón ≤ 32; título ≤ 60; nombre ≤ 24; tamaños de letra y la pila de fuentes del sistema |
| `ui` | textos de interfaz `es` y `en`: start, restart, decision |
| `positions` | 9 posiciones: `offstage_left`, `far_left`, `left`, `center_left`, `center`, `center_right`, `right`, `far_right`, `offstage_right`, con su x, su orden y si están en escena |
| `lights` | `day`, `sunset`, `dusk`, `indoor` con cielo en 3 franjas, sol o luna, estrellas, tinte, sombra, faroles encendidos, color de ventana y de nubes; `indoor` no se permite al aire libre |
| `palettes` | `clothing` (13 colores), `skin` (6), `hair` (8), `coat` (7) y `materials` (20, sin alias): siempre 3 tonos `[claro, base, sombra]` |
| `attributeSets` | atributos de aspecto por tipo: `person` (height, build, skin, head, hair, hair_color, outfit, top_color, bottom_color, accessory, accessory_color), `dog`, `cat`, `bird`. Cada atributo tiene `default` y `values` (con alias) o `palette` (los valores son las claves de esa paleta) |
| `kinds` | 9 tipos: `man`, `woman`, `boy`, `girl`, `old_man`, `old_woman` (esqueleto `biped`), `dog`, `cat` (`quadruped`), `bird` (`bird`), con altura en px por talla y valores por defecto propios |
| `items` | 10 objetos de mano para recoger y entregar: ball, book, flower, letter, key, apple, gift, cup, map, phone |
| `bases` | 8 escenarios base: `city`, `forest`, `beach`, `mountain`, `park`, `countryside`, `room` (interior), `plain` (vacío), con suelo, fondo lejano y piezas por defecto |
| `layers` | `sky`, `far`, `back`, `front` |
| `pieces` | 34 piezas con ancho, alto, capas permitidas, variantes, si se colorean, altura de asiento, si se encienden y materiales |
| `actions` | las 12 acciones con alias, tipo de movimiento, parámetros (`required`/`optional`/`forbidden`), posturas, duración, variantes (34 en total) y sus alias |
| `emotions` | 6 emociones; por intensidad 1–3, la cara y los efectos |
| `faces`, `effects` | 11 caras y 15 efectos (ojos que se salen, mandíbula, sudor, vapor, temblor, chorros de lágrimas…) con su descripción |
| `approximations` | 38 entradas de cosas fuera del catálogo (bailar, volar, dragón, caballo, escuela, amanecer, comida…) con su equivalente y una nota |

**Alias.** Cada entrada con alias tiene `aliases.es` y `aliases.en`. Normalización (la misma en el
validador, en la skill y en las pruebas): NFKD, quitar marcas combinantes, minúsculas, todo carácter
que no sea `a-z0-9` se vuelve espacio, colapsar espacios, recortar. Los ids se comparan normalizados
(`pick_up` → «pick up»). Dentro de una misma categoría y ámbito un alias normalizado apunta a un solo
id, y ningún alias es igual a su propio id. Los ámbitos son: posiciones, luces, tipos, objetos,
bases, capas, piezas, acciones, emociones, cada paleta, las variantes de cada acción, las alturas de
salto, las variantes de cada pieza y los valores de cada atributo de cada conjunto. Las
`approximations` de una categoría no repiten alias ni ids de esa categoría.

**Ampliar el catálogo** es cambiar el contrato: spec nuevo, y en el mismo cambio catálogo, motor,
pruebas y, si hace falta, esquema y validador.

### D7 · Formato del guion (`contract/script.schema.json`, formato 1)

Un guion es un objeto con estas claves (las obligatorias en negrita):

| Clave | Qué es |
|---|---|
| **`tcia`** | `1`, la versión del formato |
| **`meta`** | `title`, `slug` (nombre de archivo, kebab-case, ≤ 60), `lang` (ISO 639-1), `light` (luz por defecto), `ui` (obligatorio si `lang` no es `es` ni `en`) |
| `state` | 0–6 variables enteras `{var, initial}` (−9…9) |
| **`characters`** | 1–6 personajes `{id, name, kind, look}`; `look` lleva atributos del conjunto de su tipo; lo que falte toma el valor por defecto del tipo y, si no, del conjunto |
| **`sets`** | 1–8 escenarios `{id, base, pieces?}`. Si `pieces` está (aunque vacío), reemplaza a las piezas por defecto de la base; si no está, se usan las de la base. Cada pieza: `{piece, at, layer?, variant?, color?, dx?, flip?}` |
| **`scenes`** | **Columna principal**: 2–12 escenas, en orden. Son las del usuario |
| **`decisions`** | 2–3 decisiones `{id, after, options}`; `after` es la escena principal tras la cual aparece |
| **`endings`** | 3–4 finales `{id, title, when?, scenes}`; `title` solo sirve para el informe |
| `notes` | `approximations`, `invented`, `comment`. El motor lo ignora |

**Escena** (la misma forma para escenas principales, de rama y de final):
`{id, set, light?, cast, items?, beats}`.

- `cast`: 1–4 `{who, at, facing?, posture?, emotion?, intensity?}`. `posture` solo `standing` o
  `sitting`. Sin `facing`, mira hacia el centro (x < 960 → derecha; x > 960 → izquierda; 960 → derecha).
- `items`: 0–4 objetos `{id, item, at}` (en el suelo, en una posición en escena) o
  `{id, item, held_by}` (en la mano, boca o pico de alguien del reparto).
- `beats`: 1–24. **Beat** = `{actor, action?, variant?, to?, target?, item?, height?, emotion?,
  intensity?, say?, duration?, together?}`.
  - `action` del catálogo; sin `action` es un **beat de reacción**: necesita `emotion` y solo admite
    `emotion`, `intensity`, `target` (a quién mira), `duration` y `together`.
  - `variant`: de esa acción; si falta, `defaultVariant`.
  - Los parámetros siguen la tabla `params` de la acción y de la variante (`to` para moverse;
    `target` personaje, o personaje o posición en `point`; `item` para `pick_up`; `height` en `jump`;
    `say` obligatorio en `talk` y `think`).
  - `say`: texto del globo; en `think` es globo de pensamiento y en las demás, de diálogo.
  - `emotion` e `intensity` (1–3, por defecto 2) se aplican desde el inicio del beat y siguen hasta
    que otro beat las cambie, dentro de la escena.
  - `together: true`: empieza a la vez que el beat anterior (forman un grupo).

**Decisión, opciones, ramas y punto de unión.** Cada opción es
`{id, label, effects?, scenes?, rejoin}`:

- `label`: el texto del botón (≤ 32).
- `effects`: 0–4 `{var, add}` con `add` entre −3 y 3; se suman al estado al elegir.
- `scenes`: 0–2 **escenas de rama**, que se ven justo después de elegir.
- `rejoin`: el **punto de unión**. Debe ser la escena principal inmediatamente siguiente a `after`,
  o `@endings` si `after` es la última escena principal. El validador lo exige (E_REJOIN): una rama
  nunca salta escenas principales, no retrocede y no se anida.

Así se reúnen las ramas: la columna principal se reproduce siempre entera; una decisión solo inserta,
entre dos escenas principales, las escenas de rama de la opción elegida (o ninguna) y luego la
historia sigue en la escena principal siguiente. Esto encaja con la regla de que el usuario define
las escenas: **las escenas principales son todas del usuario y todas se ven en cualquier camino**; las
escenas de rama y de final no son de la columna principal, son la consecuencia de una opción o el
cierre, y la skill las compone a partir de lo que el usuario dijo de esa opción o final (si no dijo
nada, las inventa y lo anota en `notes.invented` y en el informe).

**Memoria de elecciones.** El estado tiene dos partes: `choices` (decisión → opción elegida), que se
guarda siempre, y `vars` (las variables de `state`), que cambian con `effects`. Nada de esto altera
los beats: solo decide el final.

**Finales.** Al acabar la última escena principal (y la rama de su decisión, si la hay), se revisan
los finales **en orden** y se ve el primero cuya condición `when` sea verdadera. Solo el último puede
omitir `when` (equivale a «siempre»). Condiciones:

```json
{ "choice": "d1", "is": "flip" }
{ "var": "bold", "op": ">=", "value": 2 }      // op: == != >= <= > <
{ "all": [ <condición>, ... ] }                // 1–6
{ "any": [ <condición>, ... ] }                // 1–6
{ "not": <condición> }
```

Con 2–3 decisiones de 2–3 opciones hay entre 4 y 27 combinaciones: el validador las recorre todas
(D10, E_NO_ENDING y E_UNREACHABLE_ENDING) y el motor también (A45).

El ejemplo del contrato (`contract/example.tcia.json`) usa todo esto: 2 escenas principales,
2 decisiones (la segunda tras la última escena, con `@endings`), una rama de una escena, una opción
sin rama, una variable, 3 finales (con `all`+`choice`, con `var` y sin `when`), un objeto, un beat
`together`, cambio de luz en un final, un levantarse automático y una caída.

### D8 · Semántica del escenario (la simulan igual el validador y el motor)

Por escena se lleva, para cada miembro del reparto: posición, mirada, postura (`standing`,
`sitting`, `lying`), objeto que sostiene (como mucho uno), emoción e intensidad. Para cada objeto:
posición en el suelo o quién lo tiene.

- **Grupos.** Los beats se agrupan: un beat sin `together` abre grupo y los `together: true` se suman
  al anterior. El primer beat de una escena no puede ser `together`. Todos los beats de un grupo se
  evalúan contra el estado al inicio del grupo y luego se aplican. Un personaje participa en un solo
  beat del grupo, como actor o como destino de `give` o `hug`. Como mucho un beat del grupo tiene
  `say`.
- **Ocupación.** Al inicio de la escena y al final de cada grupo, dos personajes no pueden estar en
  la misma posición en escena. Las posiciones fuera de escena admiten varios.
- **Fuera de escena.** Quien está en `offstage_*` solo puede `walk` o `run` (a cualquier otra
  posición, incluso la otra salida: cruzar corriendo) y sin `say`. No puede ser destino de nada.
  `jump` no puede ir a una posición fuera de escena.
- **Moverse.** `walk`/`run` exigen `to` distinto de la posición actual. `jump` con `to` viaja como
  mucho 3 marcas (diferencia de `order`); sin `to`, salta en su sitio. `cartwheel` exige `to`. Al
  moverse, mira hacia donde va y queda de pie.
- **Mirada.** Un beat con `target` (personaje o posición) gira al actor hacia ese x. `point` con
  variante `up` no lleva `target`.
- **Postura.** Si la postura actual no está en `startPostures` de la acción, se levanta primero
  (dura `standUpSeconds`, 0,5 s) y queda de pie. `sit` deja `sitting` (error si ya está sentado);
  `fall` deja `lying`. Se sienta en una pieza con `seat` (en capa `back` o `front`) que esté en su
  misma posición, a la altura de esa pieza; si no hay, en el suelo.
- **Objetos.** `pick_up`: el objeto está en el suelo en la posición del actor y el actor no sostiene
  nada. `give`: el actor sostiene algo, el destino no, el destino está en `targetPostures` y la
  distancia (diferencia de `order`) está en `distance` de la variante (`normal` 1; `toss` 1–3). Los
  objetos en el suelo solo pueden estar en posiciones en escena.
- **Abrazo.** `hug`: el destino está de pie y a distancia 1.
- **Reacción.** Un beat de reacción no mueve ni cambia postura; si tiene `target`, mira hacia él.
- **Escenas independientes.** Cada escena empieza con su `cast` e `items`; nada pasa de una escena
  a otra (ni posiciones, ni objetos, ni emociones).

### D9 · Tiempos (los calculan igual el validador y el motor)

- `readSeconds(text) = clamp(0,9 + 0,055 × n, 1,4, 6,0)`, con `n` = puntos de código del texto.
- Duración base del beat:
  - con `duration` → ese valor (debe estar entre `min` y `max` de la acción, o de `timing.reaction`);
  - `walk`/`run` → `clamp(marcas × secondsPerMark(variante), min, max)`, con
    `marcas = |x_destino − x_origen| / 240` (puede ser fraccionario: las salidas están a −220 y 2140);
  - `jump` → `clamp(1,1 + 0,25 × marcas, 0,7, 3)` (marcas = 0 si salta en su sitio);
  - resto → `defaultDuration` de la variante si existe, si no `duration.default` de la acción;
  - reacción → `timing.reaction.default` (1,2 s).
- Duración efectiva = `max(base, readSeconds(say))` (sin `say`, la base) `+ 0,5` si hubo que
  levantarse.
- Grupo = máximo de sus beats. Escena = suma de grupos + `sceneTailSeconds` (0,8).
- Camino = suma, para cada escena que se ve, de (escena + 2 × `sceneFadeSeconds`). No cuenta el
  título ni el tiempo de espera de las decisiones.
- Los resultados se informan redondeados a milésimas (`Math.round(x * 1000) / 1000`); las pruebas
  comparan con tolerancia 0,01.

Cifras de referencia, calculadas para el ejemplo del contrato:

| Escena | s |
|---|---|
| warmup | 7,395 |
| the_jump | 4,66 |
| flip_practice | 5,2 |
| end_legend | 2,36 |
| end_brave | 2,4 |
| end_buddies | 6,33 |

| Elecciones | Final | s |
|---|---|---|
| d1=flip, d2=again | legend | 22,815 |
| d1=flip, d2=rest | brave | 22,855 |
| d1=safe, d2=again | brave | 16,855 |
| d1=safe, d2=rest | buddies | 20,785 |

### D10 · Validador

`node scripts/validate.mjs <guion.tcia.json> [--json]`. Lee también `contract/catalog.json` y
`contract/script.schema.json` (rutas relativas al propio script con `import.meta.url`).

#### D10.1 · Fases

1. **Entrada** (V1–V4). Si falla, para.
2. **Esquema** (V5–V6). Si hay errores, se informan todos y para: la semántica no corre sobre un
   documento mal formado.
3. **Semántica A** (V7–V24): identidad, referencias, catálogo, textos, parámetros. Se juntan todos.
4. **Semántica B** (V25–V31): simulación de cada escena según D8. Solo en las escenas que no tuvieron
   errores en la fase 3.
5. **Flujo** (V32–V37). Solo si la fase 3 no dejó errores en `decisions`, `endings` ni `state`.
6. **Estadísticas** solo si no hay errores.

Los errores salen en el orden del documento. Cada uno lleva `code`, `path` (JSON Pointer, RFC 6901),
`message` y, si aplica, `suggestion` (un id) o `approximation` (`{to, note}` del catálogo). Los
números de beat de los mensajes (V25, V31…) empiezan en 0, igual que en las rutas JSON Pointer:
`/scenes/1/beats/0` es el «beat 0». El informe al usuario los numera desde 1 (D4).

#### D10.2 · Comprobador de esquema propio

Sin dependencias, implementa solo las palabras clave que usa el esquema: `$ref` local (`#/$defs/...`,
con recursión), `type` (`object`, `array`, `string`, `integer` = número entero, `number`, `boolean`),
`properties`, `required`, `additionalProperties: false`, `items`, `minItems`, `maxItems`, `enum`,
`const`, `pattern`, `minLength`, `maxLength` (en puntos de código), `minimum`, `maximum`, `oneOf`.
Ignora `$schema`, `$id`, `title`, `description` y los hermanos de `$ref` que sean anotaciones.
`oneOf`: válido si exactamente una rama valida; si ninguna, informa los errores de la rama cuyas
claves `required` estén todas en el objeto, y si no hay tal rama, el mensaje genérico. Una prueba
(A16) falla si el esquema usa otra palabra clave.

#### D10.3 · Reglas

Mensajes literales (en inglés: los lee Claude y el usuario técnico); `<…>` se reemplaza.

| N.º | Código | Comprueba | Mensaje |
|---|---|---|---|
| V1 | `E_USAGE` (salida 2) | Argumentos y lectura del archivo | `Usage: node validate.mjs <script.tcia.json> [--json]` · `Cannot read <file>: <reason>` |
| V2 | `E_NODE_VERSION` (salida 2) | Node ≥ 22 | `TCIA needs Node.js 22 or newer (found <version>).` |
| V3 | `E_JSON` | JSON válido | `Not valid JSON: <parser message>` |
| V4 | `E_FORMAT` | Raíz objeto con `tcia` = 1 (antes del esquema) | `Unsupported format: "tcia" must be 1 (found <value>).` |
| V5 | `E_SCHEMA` | Cualquier violación del esquema que no sea V6 | según la palabra clave: `required` → `<path>: missing required field "<name>".` · `additionalProperties` → `<path>: unknown field "<name>".` (+ sugerencia entre los campos permitidos) · `type` → `<path>: expected <type>, got <actual>.` · `enum`/`const` → `<path>: must be one of <values>.` · `pattern` → `<path>: "<value>" has the wrong format (<description of the $def>).` · `minLength`/`maxLength` → `<path>: text must have <min>–<max> characters (has <n>).` · `minimum`/`maximum` → `<path>: must be between <min> and <max> (is <value>).` · `minItems`/`maxItems` → `<path>: must have <min>–<max> items (has <n>).` · `oneOf` → `<path>: does not match any allowed form.` · Si el campo lleva un id del catálogo y falla `pattern`, se le agrega `suggestion` o `approximation` (D10.4, fase de esquema) |
| V6 | `E_COUNT_SCENES` · `E_COUNT_DECISIONS` · `E_COUNT_OPTIONS` · `E_COUNT_ENDINGS` | `minItems`/`maxItems` en `/scenes`, `/decisions`, `/decisions/<i>/options`, `/endings` | `The main column has <n> scenes; it needs 2 to 12. Main scenes come from the user: ask them, do not add or remove scenes.` · `The story has <n> decisions; it needs 2 or 3.` · `Decision <id or #i> has <n> options; it needs 2 or 3.` · `The story has <n> endings; it needs 3 or 4.` |
| V7 | `E_DUPLICATE_ID` | Ids únicos: personajes, escenarios, escenas (todas, en un solo espacio), decisiones, opciones (por decisión), finales, variables, objetos (por escena); y un personaje no se repite en el `cast` de una escena | `<kind> id "<id>" is used twice (first at <path>).` · `<path>: character "<id>" appears twice in the cast of scene "<scene>" (first at <path>).` |
| V8 | `E_ID_CLASH` | Un id de personaje no puede ser id de posición | `Character id "<id>" is also a stage position; rename the character.` |
| V9 | `E_REF` | Existen: `scene.set`, `cast.who`, `items.held_by` (en el reparto), `beat.actor` (en el reparto), `beat.target` (reparto o posición), `beat.item` (objetos de la escena), `decision.after`, `option.rejoin` (escena principal o `@endings`), `effects.var`, `condVar.var`, `condChoice.choice`, `condChoice.is` (opción de esa decisión) | `<path>: "<id>" is not a <what> (known: <up to 8 ids>).` + sugerencia por distancia |
| V10 | `E_CATALOG` | Pertenencia al catálogo: luz, tipo, valor de aspecto, base, pieza, capa, variante de pieza, color, posición, objeto, acción, variante de acción, altura, emoción | `<path>: "<value>" is not a valid <category>.` + `suggestion` o `approximation` (D10.4); si la lista de válidos tiene ≤ 12, se agrega ` Valid: <list>.` |
| V11 | `E_LOOK_KEY` | El atributo existe para ese tipo | `<path>: kind "<kind>" has no attribute "<key>" (it has: <list>).` |
| V12 | `E_PIECE` | Capa permitida para la pieza; variante solo si tiene; color solo si se colorea; `at` en escena | `Piece "<piece>" cannot go in layer "<layer>" (allowed: <list>).` · `Piece "<piece>" has no variants.` · `Piece "<piece>" cannot be colored.` · `Pieces must be on stage; "<pos>" is off stage.` |
| V13 | `E_LIGHT_BASE` | `indoor` solo con base `room` (la luz de la escena, o `meta.light` si la escena no tiene) | `<path>: light "indoor" only works in base "room"; set "<set>" uses base "<base>". Use day, sunset or dusk.` |
| V14 | `E_UI_MISSING` | `meta.ui` cuando `lang` no está en `catalog.ui` | `meta.lang "<lang>" has no built-in UI texts; add meta.ui with start, restart and decision.` |
| V15 | `E_TEXT_LENGTH` | Título ≤ 60, nombre ≤ 24, botón ≤ 32, título de final ≤ 60, textos de `ui` ≤ 32 | `<path>: <field> has <n> characters; the maximum is <max>.` |
| V16 | `E_TEXT_BLANK` | Ningún texto es solo espacios | `<path>: text is blank.` |
| V17 | `E_BALLOON_LENGTH` | `say` ≤ 80 caracteres | `<path>: balloon has <n> characters; the maximum is 80. Split it into two beats.` |
| V18 | `E_BALLOON_WORD` | Ninguna palabra de `say` > 24 | `<path>: the word "<word>" has <n> characters; balloon lines hold 24. Use a shorter word.` |
| V19 | `E_BALLOON_LINES` | `wrapText(say, 24)` ≤ 4 líneas | `<path>: balloon needs <n> lines; the maximum is 4. Shorten it.` |
| V20 | `E_BEAT_EMPTY` | Beat con `action` o con `emotion` | `<path>: a beat needs an action, or an emotion for a reaction beat.` |
| V21 | `E_REACTION` | Beat de reacción sin `variant`, `to`, `item`, `height`, `say` | `<path>: a reaction beat (no action) only accepts emotion, intensity, target, duration and together; remove "<field>".` |
| V22 | `E_PARAM` | `params` de la acción con lo que cambie la variante (`requires`, `params`) | `<path>: action "<action>" requires "<param>".` · `<path>: action "<action>" does not take "<param>".` (con variante: `action "<action>" with variant "<variant>"`) |
| V23 | `E_DURATION` | `duration` entre `min` y `max` de la acción (o de la reacción) | `<path>: duration <d>s is outside <min>–<max>s for "<action or reaction>".` |
| V24 | `E_TARGET` | Destino de tipo permitido (`targetKinds`), distinto del actor | `<path>: target of "<action>" must be a character.` · `<path>: a character cannot target itself.` |
| V25 | `E_POSITION_SHARED` | Ocupación (D8) | `<scene>: "<a>" and "<b>" are both at "<pos>" at the start.` · `… after beat <n>.` |
| V26 | `E_OFFSTAGE` | Reglas de fuera de escena (D8) | `<path>: "<actor>" is off stage (<pos>); only walk or run, without say, can bring them in.` · `<path>: "<target>" is off stage and cannot be a target.` · `<path>: jump cannot leave the stage; use walk or run.` |
| V27 | `E_MOVE` | Moverse a otra posición; salto ≤ 3 marcas | `<path>: "<actor>" is already at "<pos>".` · `<path>: jump covers <n> marks; the maximum is 3.` |
| V28 | `E_DISTANCE` | Distancia de `give` y `hug` | `<path>: "<actor>" and "<target>" are <n> marks apart; "<action>" (<variant>) needs <min>–<max>.` |
| V29 | `E_ITEM` | Objetos (D8) | `<path>: an item needs exactly one of "at" or "held_by".` · `<path>: items on the ground must be on stage.` · `<path>: "<who>" already holds "<item>".` · `<path>: item "<item>" is not on the ground at "<pos>".` · `<path>: "<actor>" holds nothing to give.` |
| V30 | `E_POSTURE` | Ya sentado; postura del destino | `<path>: "<actor>" is already sitting.` · `<path>: "<target>" must be <postures> for "<action>".` |
| V31 | `E_TOGETHER` | Grupos (D8) | `<path>: the first beat of a scene cannot be together.` · `<path>: "<who>" takes part in two beats of the same group (beats <i> and <j>).` · `<path>: only one beat per group may have a balloon.` |
| V32 | `E_DECISION_AFTER` | `after` es escena principal; una decisión por escena | `<path>: a decision must follow a main scene; "<id>" is a branch scene.` (o `an ending scene.`) · `<path>: two decisions follow "<scene>"; only one is allowed per main scene.` |
| V33 | `E_DECISION_ORDER` | `decisions` en el orden de la columna | `Decisions must be listed in story order: "<a>" comes before "<b>" in the main column.` |
| V34 | `E_REJOIN` | Punto de unión (D7) | `<path>: option "<decision>.<option>" must rejoin at "<expected>", not "<got>". Branches always return to the next main scene, or to @endings after the last one.` |
| V35 | `E_WHEN_MISSING` | Solo el último final omite `when` | `<path>: only the last ending may omit "when".` |
| V36 | `E_NO_ENDING` | Recorrido de **todas** las combinaciones: cada una llega a un final | `Choices <d1=o1, d2=o2, …> reach no ending. Make the last ending unconditional or widen a condition.` (una por combinación; con más de 10, las 10 primeras y `…and <n> more combinations.`) |
| V37 | `E_UNREACHABLE_ENDING` | Cada final es el primero en cumplirse para al menos una combinación | `Ending "<id>" is never shown: no combination satisfies it.` · `Ending "<id>" is never shown: every combination that satisfies it is taken by an earlier ending (<ids>).` |

Advertencias (no impiden armar; `ok` sigue en `true`):

| Código | Cuándo | Mensaje |
|---|---|---|
| `W_UNUSED_CHARACTER` | Personaje sin escenas | `Character "<id>" appears in no scene.` |
| `W_UNUSED_SET` | Escenario sin escenas | `Set "<id>" is used by no scene.` |
| `W_UNUSED_VAR` | Variable que ningún `effects` cambia o ninguna condición mira | `State variable "<var>" is never changed.` · `State variable "<var>" is never tested.` |
| `W_IGNORED_ATTR` | `bottom_color` con un `outfit` de `usesBottomColor: false` | `<path>: bottom_color is ignored with outfit "<outfit>".` |
| `W_LONG_PATH` | Algún camino dura más de 360 s | `The longest path lasts <s>s; consider shorter scenes.` |

#### D10.4 · Sugerencias

Para un valor `x` que no está en la categoría (y el ámbito: p. ej., variantes de *esa* acción):

1. `x` normalizado es igual a un id normalizado o a un alias de un id → `suggestion: <id>` (mensaje:
   `… Did you mean "<id>" ("<x>" is an alias)?`, o `… Did you mean "<id>"?` si es el id escrito de otra forma).
2. `x` normalizado está en una `approximation` de esa categoría → `approximation: {to, note}`
   (mensaje: `… Closest: <to as JSON>. <note>`). Si `to` es `null`, solo la nota.
3. Si no, distancia de **Damerau-Levenshtein restringida (OSA, optimal string alignment)** contra
   ids y alias normalizados: insertar, borrar o cambiar un carácter, o intercambiar dos caracteres
   vecinos, cuesta 1 cada uno (así `wlak` → `walk` es distancia 1). Umbral 1 si `x` tiene ≤ 4
   caracteres, 2 si no; gana la menor distancia y, a igualdad, el primero en el orden del catálogo
   → `suggestion: <id>`.
4. Si nada, sin sugerencia.

`E_REF` y `additionalProperties` usan solo el paso 3 (la misma distancia OSA), contra los ids o
campos conocidos.

**También en la fase de esquema.** Si un campo que lleva un id del catálogo (los que el esquema
define con `#/$defs/catalogId`) falla `pattern` por tildes, espacios, mayúsculas o guiones (como
`dragón` o `pick up`), el error sigue siendo `E_SCHEMA`, pero lleva además la `suggestion` o la
`approximation` de los pasos 1–4, calculada sobre `x` normalizado. La categoría y el ámbito salen de
la ruta, igual que en V10: `/scenes/0/beats/2/action` → acción; `/characters/1/look/hair` → valores
de `hair` del tipo de ese personaje; `/sets/0/pieces/3/variant` → variantes de esa pieza. Si el
campo del que depende el ámbito (el tipo, la acción o la pieza) tampoco es válido, se busca en la
unión de todos los ámbitos de esa categoría. El mensaje es el de `pattern` seguido del texto de la
sugerencia. Así Claude corrige en un solo paso.

#### D10.5 · Salidas

Códigos de salida: 0 válido (con o sin advertencias), 1 inválido, 2 uso o Node.

Sin `--json` (texto ASCII, una línea por hallazgo, como mucho 50 y luego `…and <n> more.`):

```text
ERROR E_REJOIN /decisions/0/options/1/rejoin: option "d1.safe" must rejoin at "the_jump", not "warmup". …
  suggestion: the_jump
WARN  W_UNUSED_SET /sets/1: Set "beach" is used by no scene.
FAIL: 1 error, 1 warning.
```

o, si es válido, una última línea:
`OK: 2 main scenes, 1 branch scene, 2 decisions, 4 paths, 3 endings, 16.855-22.855 s.`

Con `--json`, un solo objeto con exactamente estas claves:

```json
{
  "ok": true,
  "file": "<ruta tal como se pasó>",
  "errors": [ { "code": "E_…", "path": "/…", "message": "…", "suggestion": null, "approximation": null } ],
  "warnings": [ { "code": "W_…", "path": "/…", "message": "…" } ],
  "stats": {
    "mainScenes": 2, "branchScenes": 1, "endingScenes": 3, "decisions": 2, "endings": 3, "paths": 4,
    "secondsMin": 16.855, "secondsMax": 22.855,
    "outcomes": [ { "choices": { "d1": "flip", "d2": "again" }, "ending": "legend", "seconds": 22.815 } ],
    "endingsReach": { "legend": 1, "brave": 2, "buddies": 1 }
  }
}
```

`stats` es `null` si hay errores. `outcomes` va ordenado por decisiones en orden de historia y, en
cada una, opciones en su orden.

#### D10.6 · Módulos que exporta `scripts/lib/` (los usan las pruebas)

- `validate.mjs`: `validate(script, { catalog, schema }) → { ok, errors, warnings, stats }`.
- `outcomes.mjs`: `outcomes(script, catalog) → [{ choices, ending, seconds }]` (misma forma y orden
  que el motor, D14).
- `text.mjs`: `normalize(s)`, `wrapText(text, lineChars)`, `readSeconds(text, catalog)`.
- `suggest.mjs`: `suggest(value, category, scope, catalog) → { suggestion, approximation }`.
- `node-version.mjs`: `checkNode(versionString) → null | message`.
- `inject.mjs`: `inject(engineHtml, script) → html` (D12).

`wrapText` (idéntico en validador y motor): colapsar espacios en blanco a uno, recortar, partir por
espacios; voraz: la palabra entra en la línea actual si la línea está vacía o si
`largo(línea) + 1 + largo(palabra) ≤ lineChars`; si no, abre línea. Largos en puntos de código.

### D11 · Armador

`node scripts/build.mjs <guion.tcia.json> [--out <carpeta>] [--json]` (y `--engine <archivo>`, solo
para pruebas).

1. Comprueba Node (salida 2).
2. Valida con `validate()`. Si hay errores, los imprime como el validador, **no escribe nada** y
   sale con 1.
3. Lee `assets/engine.html` (relativo al script). Exige exactamente una aparición del hueco
   `__TCIA_SCRIPT_JSON__` (si no: `E_ENGINE_TEMPLATE`, `Engine template must contain the script
   placeholder exactly once (found <n>).`) y `<meta name="tcia-format" content="N">` con N igual a
   `tcia` del guion (si no: `E_ENGINE_FORMAT`, `Engine supports format <N>; the script is format <M>.`).
   Ambos salen con 1 sin escribir.
4. Inyecta (D12).
5. Carpeta de salida: `--out` o la del guion; la crea si no existe. Escribe `<slug>.html` (primero a
   `<slug>.html.tmp` y luego renombra) y `<slug>.tcia.json` = `JSON.stringify(guion, null, 2) + "\n"`,
   salvo que esa ruta sea el mismo archivo de entrada (entonces no lo toca).
6. Imprime `Built <ruta absoluta del html>` y `Script <ruta absoluta del json>`, o con `--json`
   `{ "ok": true, "html": "<abs>", "script": "<abs>", "warnings": [...] }`. Sale con 0.

Sin marcas de tiempo ni datos de la máquina: armar dos veces da los mismos bytes.

### D12 · Interfaz motor ↔ armador

`assets/engine.html` contiene, una sola vez en todo el archivo:

```html
<script type="application/json" id="tcia-script">__TCIA_SCRIPT_JSON__</script>
```

y en `<head>`:

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="tcia-format" content="1">
<meta name="tcia-engine" content="0.1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:">
```

La CSP garantiza que el archivo no pida nada a la red. El catálogo va embebido por el build del
motor en `<script type="application/json" id="tcia-catalog">…</script>`.

Inyección (`inject`): `json = JSON.stringify(guion)` (compacto, claves en el orden de entrada).
Después, dentro de `json`, cada uno de estos caracteres se reemplaza por su secuencia de escape JSON,
escrita como texto de seis caracteres (barra invertida, `u` y cuatro dígitos hexadecimales):

| Carácter | Se escribe como |
|---|---|
| `<` | `\u003c` |
| `>` | `\u003e` |
| `&` | `\u0026` |
| U+2028 (separador de línea) | `\u2028` |
| U+2029 (separador de párrafo) | `\u2029` |

Luego se sustituye el hueco **con una función de reemplazo**
(`html.replace(MARK, () => json)`), porque una cadena de reemplazo interpretaría `$&`, `$'`… del
guion. El motor nunca escribe el hueco literal en su JS (lo arma por partes, p. ej.
`'__TCIA_' + 'SCRIPT_JSON__'`), para que aparezca una sola vez. El build del motor escapa el
catálogo igual. Si el motor encuentra el hueco sin reemplazar, muestra centrado
`TCIA engine template: no script was injected.` y pone `data-tcia-state="error"`.

### D13 · Motor

#### D13.1 · Arquitectura

La lógica va separada del dibujo para probarla en Node:

| Módulo (en `engine/src/`) | Qué hace | DOM |
|---|---|---|
| `core.mjs` | Normaliza el guion con los valores por defecto, compila cada escena a una línea de tiempo (D8, D9), máquina de estados del reproductor, condiciones, recorrido de caminos, `wrapText`, `readSeconds`, `keyToOption` | No |
| `pose.mjs` | De un actor en un instante (acción, variante, fase, progreso, emoción) a una pose: transformaciones de cada articulación y escala `sx`/`sy` de la raíz | No |
| `draw/*.mjs` | De pose + aspecto + luz a un árbol SVG virtual (`{tag, attrs, children}`) para personajes, piezas, bases, cielo, objetos, efectos y globos | No |
| `registry.mjs` | Exporta `registry`: id del catálogo → implementación (D13.9) | No |
| `dom.mjs` | Monta el árbol, bucle `requestAnimationFrame`, superposiciones HTML, teclado, escalado, pausa, ganchos de prueba | Sí |

Formato de las fuentes: módulos ES `.mjs` sin dependencias; entre ellos solo
`import { a, b } from './x.mjs';` en una línea, sin `default`, sin `import()` dinámico. Nombres de
nivel superior únicos entre archivos. `engine/build.mjs` comprueba primero la versión de Node (D5), concatena en orden topológico, quita las
líneas `import` y la palabra `export`, envuelve todo en una IIFE, comprueba que compila
(`new vm.Script`), inserta CSS, JS y el catálogo en `engine/template.html` y escribe
`plugins/tcia/skills/tcia/assets/engine.html`. Con `--check` no escribe: compara y sale con 1 si
difiere. `assets/engine.html` es un artefacto generado que se confirma en git y nunca se edita a mano.
Tamaño máximo: 350 KB.

Determinismo: sin `Math.random` ni hora del reloj en la lógica; un PRNG con semilla (p. ej.
mulberry32 sobre un hash FNV-1a de `idPersonaje + idEscena`) para parpadeos y estrellas.

#### D13.2 · Sistema de dibujo

- **Partes y jerarquía.** `biped`: cadera (raíz, en el suelo) → torso → cuello → cabeza; hombro →
  brazo → antebrazo → mano (×2); cadera → muslo → pierna → pie (×2); en la cabeza: ojos, cejas,
  boca, pelo de atrás y de adelante, accesorio. `quadruped`: raíz → cuerpo; cabeza, orejas, cola y
  4 patas de 2 segmentos. `bird`: raíz → cuerpo; cabeza con pico, 2 alas, cola, 2 patas. Brazo,
  pierna, cuello, cola y patas se dibujan cada uno como una sola forma continua, calculada desde el
  esqueleto en cada fotograma, con uniones redondeadas, la raíz de la extremidad bajo el torso y la
  cabeza unida por el cuello (anexo «Estilo afinado y fluidez»).
- **Proporciones.** Cabezas grandes (niños 40–45 % de la altura, adultos 30–35 %, mayores 30 %),
  formas marcadas según `head` (círculo, óvalo, cuadrado, rectángulo alto, triángulo con la punta
  abajo, trapecio) y `build` (`shape` y `widthFactor` del catálogo). Altura total = `heightPx`.
- **Facetado leve.** Cada parte es una silueta suave (con más vértices o con curvas) rellena con el
  tono base, y encima pocas facetas planas. Luz fija desde arriba a la izquierda: las facetas que
  miran a la luz se acercan al tono claro y las opuestas al de sombra, en la medida que fija
  `FACET_CONTRAST` (0: sin facetas visibles; 1: los tonos de la paleta tal cual). Como mucho 3
  rellenos por parte. Cada parte es un `<g data-part="…">`.
- **Contorno y uniones.** Silueta de cada parte con trazo de tinta (`stage.ink`, 4 px) con
  `stroke-linejoin` y `stroke-linecap` redondos. Las partes que se tocan comparten coordenadas
  exactas. Sin costuras entre facetas: el relleno base de la silueta queda debajo de ellas, o cada
  faceta lleva un trazo de su mismo color.
- **Color.** De las paletas y materiales del catálogo. Todo lo del escenario y los personajes (no los
  globos ni la interfaz) se mezcla con `light.tint` por canal:
  `c' = round(c + (tinte − c) × strength)`. La capa `far` además se mezcla con `sky[2]` en `farFade` y
  se escala a `farScale`. Sombras: un octágono aplanado bajo cada personaje y pieza de suelo, con
  `light.shadow`. Piezas `lit` muestran un halo de `lampGlow` (opacidad 0,35) si `lampsOn`; las
  ventanas usan `light.window`; con `stars`, estrellas de 4 puntas en posiciones con semilla.
- **Solo estos elementos SVG:** `svg`, `g`, `polygon`, `polyline`, `path` (solo comandos M, L, H, V,
  C, S, Q, T y Z, en mayúscula o minúscula; sin arcos `A`), `rect`, `circle` (r ≤ 14), `text`, `tspan`. Rellenos y trazos: hexadecimal `#RRGGBB` o `none`.
  Nada de `linearGradient`, `radialGradient`, `filter`, `pattern`, `mask`, `clipPath`, `image`,
  `foreignObject` ni `url(`.
- **Rendimiento.** La geometría de cabezas, torsos y piezas se construye una vez por escena; en cada
  fotograma cambian `transform`, visibilidad, los atributos que se animan y las siluetas de las
  extremidades continuas. A50 (menos de 12 ms por fotograma) no cambia.

#### D13.3 · Acciones

Toda acción tiene tres fases: **anticipación** (15–25 % de la duración base: se encoge en sentido
contrario al movimiento), **acción principal** y **seguimiento** (10–20 %: se pasa y vuelve). Aplastar
y estirar sobre la raíz, con volumen constante (`sx ≈ 1/sy`). En `jump` (todas las variantes), `fall`
(todas) y `sit.flop`, en los tres esqueletos, la prueba exige (A35): anticipación con `sy` mínimo en
[0,75; 0,92], despegue con `sy` máximo en [1,08; 1,30] y `|sx·sy − 1| ≤ 0,05` siempre.

| Acción | Persona (`biped`) | Perro y gato (`quadruped`) | Ave (`bird`) |
|---|---|---|---|
| walk | 2 pasos por marca con rebote. sneak: agachado, pasos largos de puntillas. strut: pecho afuera, rodillas altas. stomp: pisadas pesadas con nubecitas de polvo | trote de 4 patas; las mismas variantes con la cola como indicador | camina a saltitos |
| run | brazos y piernas en ciclo rápido, inclinado. dash: piernas en rueda borrosa (polígono en espiral), líneas de velocidad, polvo. panic: brazos agitándose sobre la cabeza | galope; dash con líneas de velocidad | vuela bajo, aleteando |
| jump | normal: agacharse, subir, caer. flip: giro de 360° hacia adelante en el vértice. backflip: −360°. spin: giro sobre su eje vertical con un multiplicador de giro aparte (`turn`, de 1 a −1 y de vuelta, dos veces) que se aplica al dibujo además de `sx`/`sy`; `sx = 1/sy` se mantiene. cartwheel: viaja girando 360° en el plano, manos al suelo a mitad. split: piernas abiertas y brazos arriba en el vértice. Altura: `heights.px` | mismos giros con el cuerpo entero | aleteo hacia arriba; flip/backflip como rizo, cartwheel como tonel, split con las alas abiertas |
| wave | brazo arriba, mano a 3 Hz. big: los dos brazos y un saltito | levanta una pata delantera | agita un ala |
| talk | boca con 3 formas a 8 Hz mientras dura el globo, un gesto con la mano. shout: inclinado, boca enorme, líneas de grito. whisper: se acerca al destino, mano junto a la boca | boca abierta, líneas de ladrido o maullido | pico que se abre |
| point | brazo extendido hacia el destino (cabeza del personaje o x de la posición a 200 px del suelo). accuse: inclinado 10° y el brazo tiembla. up: brazo al cielo | pose de muestra con una pata | ala extendida |
| sit | baja a la altura del asiento o al suelo. flop: cae de golpe, aplasta y rebota | se sienta sobre las patas traseras | se posa o se echa |
| pick_up | se agacha (anticipación), agarra entre 30 % y 60 %, sube con el objeto. snatch: más rápido, líneas de velocidad | lo toma con la boca | lo toma con el pico |
| give | extiende el brazo; el objeto viaja en línea recta a la mano del destino. toss: el objeto vuela en parábola (200 px) y el destino lo atrapa al final | con la boca, acercándose | con el pico |
| fall | trip: de bruces (gira 90° hacia donde mira). slip: los pies vuelan y cae de espaldas (−90°). faint: se tambalea dos veces y cae despacio de espaldas, ojos cerrados. Queda acostado | de lado, patas arriba | da tumbos y queda de lado |
| hug | los dos se acercan un 35 % de la distancia y vuelven. bear: alza al destino 40 px y gira con él | se para en dos patas apoyado en el destino | lo envuelve con las alas |
| think | mano en el mentón, mirada arriba, globo de pensamiento. idea: dedo arriba y destellos al 40 % | ladea la cabeza | ladea la cabeza |

Levantarse automático: de `sitting` o `lying` a `standing` en 0,5 s. Girarse: cuando cambia la
mirada, el mismo multiplicador `turn` pasa de 1 a 0,1 y a −1 en 0,15 s al inicio del beat, sin
alargarlo y sin tocar `sx`/`sy`. Inactivo:
respiración (`breathScale` a `breathPeriod`) y parpadeo cada 2–5 s (`blinkSeconds`). Quien está en
una posición fuera de escena no se dibuja.

#### D13.4 · Emociones, caras y efectos

Cada emoción e intensidad fija una cara y una lista de efectos (`emotions.<e>.levels`). Los efectos
`burst` se disparan al inicio del beat que pone esa emoción (no al inicio de escena) y duran
`seconds`; los `loop` siguen mientras la emoción dure. La amplitud se escala ×0,6, ×1 y ×1,6 para las
intensidades 1, 2 y 3. Un beat de reacción hace una «toma»: anticipación corta y estirón, más los
efectos. Los 15 efectos y 11 caras están descritos en el catálogo; las formas son polígonos como el
resto (gotas, vapor, destellos de 4 puntas, ojos sobre tallos, mandíbula que cae hasta el suelo en
intensidad 3).

#### D13.5 · Globos

- Diálogo: rectángulo con esquinas cortadas (octágono), relleno blanco, contorno de tinta, cola
  triangular hacia la parte de arriba de la cabeza de quien habla. Pensamiento: nube de polígono con
  bultos y 3 círculos pequeños hacia la cabeza.
- Texto: `fontStack` del catálogo, 40 px, interlineado 48, color tinta, centrado; líneas de
  `wrapText(say, 24)`.
- Tamaño: ancho = `caracteres de la línea más larga × 0,6 × 40 + 2 × 36`; alto = `líneas × 48 + 2 × 36`.
- Posición: borde de abajo a 40 px sobre la cabeza de quien habla, medida de pie (no sigue los
  saltos); x sigue al personaje cada fotograma, limitada a [24, 1896 − ancho]; si el borde de arriba
  quedara < 24, se baja hasta 24 y la cola se alarga.
- Aparece con escala 0,6 → 1,05 → 1 en 0,18 s y se va en 0,12 s. Dura todo el beat. Nunca hay más de
  un globo a la vez (D8).

#### D13.6 · Pantallas e interfaz

- **Escalado.** `body` negro sin márgenes ni scroll. Contenedor `#stage` absoluto y centrado con
  `width: min(100vw, calc(100vh * 16 / 9))`, `height: min(100vh, calc(100vw * 9 / 16))` y
  `container-type: inline-size`; el SVG ocupa el 100 %. Las superposiciones son HTML dentro del
  contenedor, con tamaños en `cqw`, para que escalen con el lienzo. Franjas negras arriba y abajo o a
  los lados según la ventana. Sin media queries ni diseño táctil.
- **Título.** Fondo: el escenario y el reparto inicial de la primera escena principal, quietos con
  respiración, bajo un velo de tinta al 35 %. Encima, el título (`wrapText(title, 30)`, unos 5cqw) y
  un botón con `ui.start`. Enter o Espacio sobre el botón (tiene el foco) empiezan.
- **Reproducción.** Sin interfaz. Fundido a negro de 0,4 s entre escenas.
- **Decisión.** Al terminar la escena con decisión (cola incluida) y tras 0,3 s: velo al 30 % y una
  fila de 2–3 botones centrada en el tercio inferior, cada uno con su número (1, 2, 3) y su `label`.
  El grupo tiene `role="group"` y `aria-label` = `ui.decision`. El foco va al primer botón; teclas
  1/2/3 (fila superior o teclado numérico) o clic eligen. Sin límite de tiempo: la historia no
  avanza, pero siguen la respiración, el parpadeo y los efectos `loop`.
- **Estado.** Al elegir: se guarda `choices[decisión] = opción` y se suman los `effects`. Después,
  las escenas de rama y la escena de unión.
- **Final.** Tras la última escena del final: velo al 40 % y **un solo botón**, `ui.restart`, con
  el foco. Ningún otro texto. Al pulsarlo: estado inicial y reproducción desde la primera escena
  principal (sin volver al título).
- **Textos de interfaz.** `meta.ui` si existe; si no, `catalog.ui[meta.lang]`. El motor pone
  `document.title` = título del guion y `<html lang>` = `meta.lang`.
- Al ocultarse la pestaña (`visibilitychange`) el reloj se pausa; el paso de tiempo por fotograma se
  limita a 0,1 s.
- Foco visible en todos los botones (contorno de 3px en color claro).

#### D13.7 · Ganchos de prueba en el HTML

Atributos en `<html>`, siempre actualizados:

| Atributo | Valor |
|---|---|
| `data-tcia-state` | `loading`, `title`, `playing`, `deciding`, `ended`, `error` |
| `data-tcia-scene` | escena actual |
| `data-tcia-decision` | decisión abierta (si `deciding`) |
| `data-tcia-choices` | `d1=flip,d2=again` |
| `data-tcia-ending` | final elegido, en cuanto se decide |
| `data-tcia-errors` | errores capturados: `error`, `unhandledrejection` y llamadas a `console.error` |
| `data-tcia-frame-ms` | solo en modo automático: promedio de ms de JS por paso |

Fragmento de URL `#tcia=<clave>:<valor>;…` (lo desconocido o mal formado se ignora sin error):

- `auto:<i>.<j>.<k>` — modo automático: salta el título, en cada decisión elige la opción i-ésima
  (base 1; si falta, la 1) al instante, y avanza un reloj simulado en pasos de 1/15 s dibujando cada
  paso, en tandas de 10 pasos con `setTimeout(…, 0)`. Se detiene en `ended` (no reinicia).
- `stop:<estado>[@n]` — con `title`, `deciding` o `ended`: congela el reloj en la n-ésima vez
  (por defecto 1) que se llega a ese estado, con la superposición visible. Sirve para capturas.

#### D13.8 · Navegador para pruebas (`tests/engine/helpers/chrome.mjs`, de A)

- `findChrome() → string | null`: `TCIA_CHROME`; si no, en el PATH `google-chrome`,
  `google-chrome-stable`, `chromium`, `chromium-browser`, `chrome`; si no, la instalación estándar
  de macOS y de Windows.
- `dumpDom(htmlPath, { hash, budgetMs = 600000, width = 1920, height = 1080 }) → { dom, stderr, code }`
  con `--headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=<ms> --window-size=W,H
  --user-data-dir=<carpeta temporal> --dump-dom file://…#…`; la carpeta temporal se borra al terminar.
- `screenshot(htmlPath, { hash, width, height, out })`.
- Sin Chrome, las pruebas de navegador se marcan `skip` con `Chrome not found: set TCIA_CHROME`.
  Saltada no es cumplida. Si `--virtual-time-budget` no sirviera en la versión de Chrome del
  auditor, se usa `--remote-debugging-pipe` con un cliente CDP mínimo, sin dependencias.

#### D13.9 · Registro para la prueba de cobertura

`registry.mjs` exporta:

```js
export const registry = {
  actions,     // actions[action].variants[variant][rig] → función de pose
  emotions,    // emotions[emotion][1|2|3] → { face, effects }
  faces,       // faces[face] → dibujo
  effects,     // effects[effect] → dibujo
  kinds,       // kinds[kind] → constructor del personaje
  attributes,  // attributes[set][attribute][value] → dibujo o modificador (los de paleta: la paleta)
  bases, pieces /* [piece][variant|'default'] */, lights, items
};
```

La prueba (A33) recorre el catálogo y exige una entrada por id que, llamada, devuelva un árbol no
vacío con al menos un `polygon` o `path`.

### D14 · API de la lógica del motor (`engine/src/core.mjs`)

```js
export const FORMAT = 1;
export function prepare(script, catalog);   // → Story: guion normalizado y escenas compiladas
export function outcomes(story);            // → [{ choices, ending, seconds }] (orden de D10.5)
export function createPlayer(story);        // → Player
export function evalCondition(cond, { choices, vars }); // → boolean
export function wrapText(text, lineChars);  // → string[] (D10.6)
export function readSeconds(text, catalog); // → number (D9)
export function keyToOption(key, count);    // '1' | 'Digit1' | 'Numpad1' … → índice 0..count-1, o -1
```

`Player`:

| Miembro | Qué es |
|---|---|
| `state` | `title`, `playing`, `deciding`, `ended` |
| `sceneId`, `sceneTime` | escena actual y segundos dentro de ella |
| `decisionId`, `options` | decisión abierta y `[{ id, label }]` (si `deciding`) |
| `choices`, `vars` | memoria de elecciones y variables |
| `endingId` | final elegido (desde que se decide) |
| `start()` | `title` → `playing` |
| `advance(dt)` | avanza el reloj; devuelve eventos `{type:'scene', id}`, `{type:'decision', id}`, `{type:'choice', decision, option}`, `{type:'ending', id}`, `{type:'ended'}`. En `deciding`, `title` y `ended` no avanza la historia |
| `choose(i)` | elige la opción i (base 0); `RangeError` si no hay decisión abierta o i está fuera de rango |
| `restart()` | estado inicial y `playing` en la primera escena principal |
| `frame()` | datos para dibujar: escena, luz, escenario, fundido, actores (x, y, mirada, postura, acción, variante, fase, progreso, emoción, intensidad, objeto), objetos y globo |

`prepare` confía en un guion ya validado, pero si recibe algo estructuralmente imposible lanza
`TypeError` en vez de seguir.

### D15 · Ejemplos

`examples/<slug>/` con `<slug>.tcia.json`, `<slug>.html` (armado, confirmado en git) y
`request.txt` (el pedido en lenguaje natural, en el idioma de la historia, tal como se le daría a la
skill). `examples/rebuild.mjs` arma todos con el armador. Las 5 historias:

| # | Idioma del pedido y `lang` | Qué es |
|---|---|---|
| 1 | español, `es` | Historia original con acrobacias de un chico temerario (personaje propio, con amigos o familia propios). 4–6 escenas principales en ciudad y parque, 3 decisiones, 4 finales |
| 2 | inglés, `en` | Segunda historia original del mismo protagonista, en montaña o playa. 3–5 escenas, 2 decisiones, 3 finales. Al menos una aproximación anotada en `notes` (p. ej. patineta → `run.dash`) |
| 3 | español, `es` — `test-people-actions` | Las 6 clases de persona; las 12 acciones con sus 34 variantes; las 6 emociones con intensidades 1, 2 y 3; beats de reacción, `together`, levantarse automático; los 10 objetos |
| 4 | inglés, `en` — `test-animals-places` | Perro, gato y ave con sus valores de atributo (los que no quepan los completan las otras historias; A43); las 8 bases, las 4 luces, las 34 piezas con todas sus variantes, capas y algún color; las 9 posiciones, con entradas y salidas |
| 5 | portugués, `pt` con `meta.ui` — `test-flow-max` | 12 escenas principales cortas, 3 decisiones de 3 opciones (27 caminos), 4 finales con los 5 tipos de condición, ramas de 0, 1 y 2 escenas, una decisión tras la última escena (`@endings`) |

Entre las 5 historias juntas (A43): cada acción×variante, cada acción en los 3 esqueletos, cada
emoción×intensidad, cada luz, base, tipo, valor de atributo (incluidos todos los colores de paleta),
pieza×variante, capa, posición, objeto y altura de salto, al menos una vez (A43).

Las historias 1 y 2 usan, cada una, al menos 4 variantes acrobáticas distintas de `jump.flip`,
`jump.backflip`, `jump.spin`, `jump.cartwheel`, `jump.split` y `run.dash`, y al menos 4 emociones
distintas con intensidad 3. Reglas de aspecto del protagonista (para no imitar a nadie): ropa de dos
piezas (no `overalls` ni `suit`), casco de color que no sea blanco, cabeza `circle`, `oval` o
`square`, pelo visible (`spiky`, `short` o `curly`). Nombres propios, inventados, de todos los
personajes.

### D16 · Pruebas

Todas con `node --test` (Node 22, sin dependencias). Carpetas y dueños:

| Carpeta | Dueño | Archivos y qué cubren |
|---|---|---|
| `tests/engine/` | A | `core.test.mjs` (normalización, condiciones, `wrapText`, `readSeconds`, `keyToOption`), `timing.test.mjs` (D9 contra las cifras del ejemplo), `player.test.mjs` (estados, espera, `choose`, `restart`), `pose.test.mjs` (A35), `draw.test.mjs` y `svg-rules.test.mjs` (A34, A38), `catalog-coverage.test.mjs` (A33), `build-sync.test.mjs` (A39, A40), `walk-all-paths.test.mjs` (A45, sobre el ejemplo del contrato, `examples/*/*.tcia.json` y sus propios fixtures), `browser.test.mjs` (A47); `helpers/chrome.mjs`, `helpers/inject.mjs` (copia de la inyección de D12 solo para sus fixtures), `fixtures/` |
| `tests/contract/` | B | `catalog.test.mjs` (A15), `schema.test.mjs` (A16) |
| `tests/validator/` | B | `rules.test.mjs`: un fixture malo por código en `fixtures/bad/<CODE>__<nombre>.tcia.json` con `<…>.expect.json` = `{ "code", "path" }`; falla si algún código de D10.3 (salvo E_USAGE y E_NODE_VERSION) no tiene fixture. `good.test.mjs` (≥ 5 buenos en `fixtures/good/`), `suggest.test.mjs`, `outcomes.test.mjs`, `text.test.mjs`, `cli.test.mjs`, `node-version.test.mjs` |
| `tests/build/` | B | `build.test.mjs` (A27–A31) con motores falsos en `fixtures/` vía `--engine` |
| `tests/examples/` | B | `examples.test.mjs` (A41, A42), `coverage.test.mjs` (A43, A44), `consistency.test.mjs` (A46: importa `engine/src/core.mjs` y `scripts/lib/outcomes.mjs`) |
| `tests/repo/` | B | `layout.test.mjs`, `docs.test.mjs`, `hygiene.test.mjs`, `forbidden-terms.test.mjs` (A1–A12); `fixtures/prompts/` (pedidos de D4) |

Las pruebas escriben solo en carpetas temporales del sistema (`os.tmpdir()`) y las borran.

### D17 · Nombres vetados, imitación, rutas y secretos

- **Lista vetada.** `tests/repo/forbidden-terms.sha256.json` (contrato, sin dueño) guarda solo
  hashes SHA-256 de palabras y secuencias de 1–3 palabras que ningún archivo puede contener: nombres
  propios de obras, personajes, lugares y empresas ajenas. Las palabras no están escritas en ningún
  archivo del repo, ni aquí.
- **Algoritmo** (`forbidden-terms.test.mjs`): para cada archivo bajo la raíz, salvo `.git/` y
  `node_modules/`, y salvo binarios (contienen un byte 0), por línea: NFKD, quitar marcas
  combinantes, separar camelCase (espacio entre `[a-z0-9]` y `[A-Z]`), minúsculas, todo lo que no sea
  `a-z0-9` a espacio, partir en palabras, y para cada posición formar las secuencias de 1, 2 y 3
  palabras unidas por un espacio; si el SHA-256 hexadecimal de alguna está en `hashes`, falla con
  `<archivo>:<línea>` y los 12 primeros caracteres del hash, nunca la palabra. Antes comprueba
  `selfTest` (`tciaselftest`).
- **Añadir un término**: calcular el hash fuera del repo con este algoritmo y agregarlo con un spec.
- **Estilo con palabras propias**: «caricatura geométrica y plana, lowpoly de siluetas suaves y
  facetado leve, acción exagerada». Ningún archivo dice «inspirado en» ni «al estilo de» una obra o empresa concreta.
- **No imitar**: los personajes de los ejemplos siguen D15.
- **Higiene** (`hygiene.test.mjs`): ningún archivo contiene rutas de carpetas personales (expresiones
  `\/(home|Users)\/[A-Za-z0-9._-]+\/` y `[A-Za-z]:\\Users\\`), bloques de clave privada, ni tokens
  con forma de clave de nube, de GitHub, de Slack o de API; no hay archivos `.env*`, `node_modules`
  ni lockfiles. Las expresiones se arman por partes en la prueba para que no se detecte a sí misma.

### D18 · CLAUDE.md y README

`CLAUDE.md` (inglés, para quien contribuye). Empieza con qué es el repo en tres líneas y las reglas
fijas: cero dependencias, Node ≥ 22, el contrato no se toca sin spec, `assets/engine.html` se genera,
SKILL.md < 500 líneas, nada de nombres de obras ajenas (D17), las pruebas no escriben dentro
del repo. Luego la tabla:

| If you're going to… | Read… |
|---|---|
| change how something is drawn or animated | this spec D13, `engine/src/`, `contract/catalog.json`, `tests/engine/` |
| change the validator or its messages | D10, `scripts/lib/`, `references/errors.md`, `tests/validator/` |
| change the builder or the engine placeholder | D11, D12, `tests/build/` |
| add an action variant, a piece, a kind or any catalog id | D6 ("Ampliar el catálogo"): write a spec first; then catalog, engine, validator, tests and examples in one change |
| change the script format | D7, D8, D9, `contract/script.schema.json`: new spec and a new `tcia` format number |
| edit what the skill tells Claude | D3, D4, `SKILL.md`, `references/` |
| add or rebuild an example | D15, `examples/`, `npm run build:examples` |
| run the tests | D16 and the commands below |
| release a version | D20 |

Y los comandos: `npm test`, `npm run test:engine`, `npm run test:validator`, `npm run test:examples`,
`npm run test:repo`, `npm run build:engine`, `npm run check:engine`, `npm run build:examples`,
`claude plugin validate .`, `claude --plugin-dir ./plugins/tcia`.

`README.md` (inglés) y `README.es.md` (español), con los mismos encabezados `##` en el mismo orden:
qué es (y una línea a la otra versión del README); ejemplos (cómo abrir `examples/*/*.html`); instalar
(los comandos de D2, literales); usar (un pedido de ejemplo y qué devuelve); qué se puede pedir
(resumen del catálogo y la política de aproximaciones y seres reales); límites (solo escritorio, sin
audio ni narrador, catálogo cerrado, 2–3 decisiones, 3–4 finales); requisitos (Node ≥ 22); cómo
funciona (guion → validador → armador → motor); contribuir (remite a `CLAUDE.md`); licencia (MIT,
Solare S.A.S.).

### D19 · Reparto entre los dos ingenieros

Trabajan a la vez, cada uno en su carpeta hermana del repo, desde el commit base:

```text
git -C tcia worktree add ../tcia-motor -b feat/motor <commit base>
git -C tcia worktree add ../tcia-skill -b feat/skill <commit base>
```

**Contrato — no es de nadie.** Los dos lo leen; ninguno lo cambia. Si alguno cree que está mal,
para y lo informa a quien encargó; el cambio sería un spec nuevo.

- `plugins/tcia/skills/tcia/contract/catalog.json`
- `plugins/tcia/skills/tcia/contract/script.schema.json`
- `plugins/tcia/skills/tcia/contract/example.tcia.json`
- `tests/repo/forbidden-terms.sha256.json`
- `specs/shared/2026-11-25/00_primera-version.md` (la sección 9 la llena el auditor)

**Ingeniero A — MOTOR.** Le pertenece exactamente:

- `engine/` entero: `engine/build.mjs`, `engine/template.html`, `engine/src/**`
- `plugins/tcia/skills/tcia/assets/engine.html` (generado por `engine/build.mjs`)
- `tests/engine/**` (incluidos `helpers/` y `fixtures/`)

**Ingeniero B — VALIDADOR + SKILL + DOCUMENTACIÓN.** Le pertenece exactamente:

- `.claude-plugin/marketplace.json`
- `plugins/tcia/.claude-plugin/plugin.json`
- `plugins/tcia/skills/tcia/SKILL.md`
- `plugins/tcia/skills/tcia/references/**`
- `plugins/tcia/skills/tcia/scripts/**`
- `examples/**`
- `tests/contract/**`, `tests/validator/**`, `tests/build/**`, `tests/examples/**`
- `tests/repo/**` salvo `tests/repo/forbidden-terms.sha256.json`
- `CLAUDE.md`, `README.md`, `README.es.md`, `LICENSE`, `.gitignore`, `package.json`

Nadie más escribe en el repo durante la implementación.

**Dependencias y orden.** Los dos arrancan a la vez con lo que da el contrato. B escribe los guiones
de los ejemplos y valida sin esperar al motor; A prueba con el ejemplo del contrato y sus fixtures.
Lo que cruza los dos lados se cierra al integrar:

1. Se mezclan las dos ramas en `main` (no hay archivos comunes, así que no hay conflictos).
2. B corre `npm run build:examples` con el `engine.html` final y confirma los HTML.
3. Se corre `npm test` completo, con Chrome disponible, y `claude plugin validate`.
4. Se quitan los worktrees: `git -C tcia worktree remove ../tcia-motor` y `../tcia-skill`.

`.gitignore` exacto:

```text
node_modules/
.DS_Store
Thumbs.db
*.log
*.tmp
.env
.env.*
engine/dist/
```

### D20 · Versión y publicación

Primera versión `0.1.0` (en `plugin.json` y `package.json`); se etiqueta `v0.1.0` al publicar. Cada
publicación posterior sube la versión de `plugin.json` (si no, los usuarios no reciben el cambio,
según la documentación). Publicar el repo como público en `SOLARE-TI/tcia` solo con aprobación
expresa del usuario y después de §7.

---

## 4. Contrato

No hay API HTTP. Los contratos de esta entrega son archivos e interfaces de línea de comandos:

| Contrato | Dónde se define |
|---|---|
| Formato del guion | `contract/script.schema.json` + D7, D8, D9 |
| Catálogo | `contract/catalog.json` + D6 |
| Guion mínimo válido | `contract/example.tcia.json` |
| CLI y salida JSON del validador | D10.5 |
| CLI del armador | D11 |
| Hueco del motor e inyección | D12 |
| API de la lógica del motor | D14 |
| Ganchos de prueba del HTML | D13.7 |
| Ayudante de navegador | D13.8 |
| Lista de términos vetados | `tests/repo/forbidden-terms.sha256.json` + D17 |

---

## 5. Bocetos

Solo escritorio, por decisión aprobada: no hay boceto de celular. Lienzo 1920×1080; a 1280×720 se
ve igual, escalado; a 1280×900 aparecen franjas negras arriba y abajo.

```text
Título                                        Reproducción
┌──────────────────────────────────────┐      ┌──────────────────────────────────────┐
│ cielo (3 franjas planas)        ☼    │      │            ┌───────────────────┐     │
│   ▲▲ fondo lejano facetado           │      │            │ Rocky, today I    │     │
│  ░░░░░░░░ velo 35 % ░░░░░░░░░░░░░    │      │            │ jump the ramp!    │     │
│        NICO AND THE RAMP             │      │            └────────▼──────────┘     │
│            [ Start ]                 │      │   ◆ árbol        ◆◆ Nico   ▲ Rocky   │
│   personajes quietos, respirando     │      │ ═════════════ suelo (y=900) ══════   │
└──────────────────────────────────────┘      └──────────────────────────────────────┘

Decisión (la historia espera)                 Final
┌──────────────────────────────────────┐      ┌──────────────────────────────────────┐
│  último fotograma, idle, velo 30 %   │      │  último fotograma, velo 40 %         │
│                                      │      │                                      │
│   ┌──────────────────┐ ┌───────────┐ │      │           [ Start over ]             │
│   │1  Go for the flip!│ │2 Play it  │ │      │                                      │
│   └──────────────────┘ │  safe     │ │      │  (ningún otro texto)                 │
│        teclas 1/2/3    └───────────┘ │      │                                      │
└──────────────────────────────────────┘      └──────────────────────────────────────┘
```

---

## 6. Archivos

Ya creados con este spec (contrato):

| Archivo | Contenido |
|---|---|
| `plugins/tcia/skills/tcia/contract/catalog.json` | Catálogo cerrado (D6) con alias es/en |
| `plugins/tcia/skills/tcia/contract/script.schema.json` | JSON Schema 2020-12 del guion, formato 1 (D7), con el subconjunto de D10.2 |
| `plugins/tcia/skills/tcia/contract/example.tcia.json` | Guion mínimo válido (D7, cifras en D9) |
| `tests/repo/forbidden-terms.sha256.json` | 23 hashes y la autoprueba (D17) |
| `specs/shared/2026-11-25/00_primera-version.md` | Este spec |

Por crear (todos nuevos; el dueño entre paréntesis, D19):

| Archivo o carpeta | Qué lleva |
|---|---|
| `.claude-plugin/marketplace.json` (B) | D2 |
| `plugins/tcia/.claude-plugin/plugin.json` (B) | D2 |
| `plugins/tcia/skills/tcia/SKILL.md` (B) | D3 |
| `plugins/tcia/skills/tcia/references/*.md` (B) | D3: 5 archivos |
| `plugins/tcia/skills/tcia/scripts/validate.mjs`, `build.mjs`, `lib/*.mjs` (B) | D10, D11, D12 |
| `plugins/tcia/skills/tcia/assets/engine.html` (A) | Generado (D13.1) |
| `engine/build.mjs`, `engine/template.html`, `engine/src/*.mjs` (A) | D12, D13, D14 |
| `examples/<slug>/…` ×5, `examples/rebuild.mjs` (B) | D15 |
| `tests/engine/**` (A) | D16 |
| `tests/contract/**`, `tests/validator/**`, `tests/build/**`, `tests/examples/**`, `tests/repo/**` (B) | D16, D17 |
| `CLAUDE.md`, `README.md`, `README.es.md` (B) | D18 |
| `LICENSE` (B) | Texto MIT estándar con `Copyright (c) 2026 Solare S.A.S.` |
| `.gitignore`, `package.json` (B) | D19, D5 |

Ningún archivo existente se edita, salvo la sección 9 de este spec al auditar.

---

## 7. Antes de desplegar

No hay despliegue ni migraciones: el repo no corre en ningún servidor. «Salir» es publicar el repo.

1. Integración (D19) y auditoría contra §8, hecha por alguien que no implementó.
2. Antes de hacer público el repo: `npm test` completo con Chrome (`TCIA_CHROME` si hace falta),
   `claude plugin validate .` y `claude plugin validate ./plugins/tcia` con `--strict`, y revisar que
   la prueba de nombres vetados y la de higiene corren sobre el árbol final (A11, A12).
3. Con aprobación expresa del usuario: crear `SOLARE-TI/tcia`, subir `main`, etiquetar `v0.1.0`.
4. Probar la instalación desde GitHub en una máquina limpia (A4 con `SOLARE-TI/tcia` en vez de `./`).

Volver atrás: si algo sale mal después de publicar, se vuelve privado el repo (los usuarios que ya lo
añadieron dejan de recibir actualizaciones) y se publica una versión corregida con número mayor.

---

## 8. Criterios de aceptación

Salvo que se diga otra cosa, los comandos se corren desde la raíz del repo. «Pasa» = código de
salida 0.

**Estructura y empaquetado**

- **A1.** El árbol coincide con D1 y §6: no sobra ni falta nada. `node --test tests/repo/layout.test.mjs` pasa.
- **A2.** `claude plugin validate . --strict` termina en `Validation passed`, sin advertencias.
- **A3.** `claude plugin validate ./plugins/tcia --strict` termina en `Validation passed`, sin advertencias.
- **A4.** (Manual) En un clon limpio: `claude plugin marketplace add ./` y `claude plugin install tcia@tcia` instalan; `claude plugin details tcia` lista la skill `tcia`; después `claude plugin marketplace remove tcia`.
- **A5.** (Manual) Con `claude --plugin-dir ./plugins/tcia`, `/tcia:tcia` aparece en el menú `/`, carga la skill, y `validate.mjs`/`build.mjs` corren sin pedir permiso (regla de `allowed-tools`).
- **A6.** `package.json` es el de D5 y no hay `node_modules` ni lockfiles. `node --test tests/repo/hygiene.test.mjs` pasa.
- **A7.** `LICENSE` es el texto MIT con `Copyright (c) 2026 Solare S.A.S.` y `plugin.json` tiene `"license": "MIT"`. `node --test tests/repo/layout.test.mjs` pasa.
- **A8.** SKILL.md: frontmatter idéntico a D3 (solo `name`, `description`, `license`, `compatibility`, `allowed-tools`), `description` ≤ 1.536 caracteres con los disparadores de D3 en español y en inglés, menos de 500 líneas, cuerpo en inglés, y toda ruta a `contract/`, `references/` y `scripts/` escrita con `${CLAUDE_SKILL_DIR}`. `docs.test.mjs` comprueba además que las únicas órdenes de terminal de SKILL.md son `node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs` y `node ${CLAUDE_SKILL_DIR}/scripts/build.mjs` (ningún `node --version`, `node -e` ni otra). `node --test tests/repo/docs.test.mjs` pasa.
- **A9.** `README.md` (inglés) y `README.es.md` (español) tienen la misma cantidad de encabezados `##`, en el orden de D18, y contienen literalmente los cuatro comandos de instalación de D2. `docs.test.mjs` pasa.
- **A10.** `CLAUDE.md` está en inglés y tiene la tabla «If you're going to… / Read…» con las filas de D18. `docs.test.mjs` pasa.
- **A11.** Ningún archivo contiene rutas personales, claves privadas ni tokens, y no hay archivos `.env*`. `hygiene.test.mjs` pasa.
- **A12.** Ningún archivo del repo, este spec incluido, contiene un término vetado; la autoprueba del hash pasa. `node --test tests/repo/forbidden-terms.test.mjs` pasa.
- **A13.** `checkNode('20.11.0')` devuelve el mensaje de V2 y `checkNode('22.0.0')` devuelve `null`; `validate.mjs` y `build.mjs` salen con 2 cuando `checkNode` falla. `node --test tests/validator/node-version.test.mjs` pasa.

**Contrato**

- **A14.** Los archivos de contrato no cambiaron desde el commit base: `git diff --exit-code <base> -- plugins/tcia/skills/tcia/contract tests/repo/forbidden-terms.sha256.json` sale con 0.
- **A15.** El catálogo es consistente: alias únicos por ámbito y distintos de su id, referencias a paletas, materiales, piezas, posiciones, capas, caras y efectos válidas, valores por defecto válidos, y conteos 12 acciones, 34 variantes, 6 emociones, 9 tipos, 4 luces, 8 bases, 34 piezas, 10 objetos, 9 posiciones. `node --test tests/contract/catalog.test.mjs` pasa.
- **A16.** El esquema usa solo las palabras clave de D10.2 y el ejemplo del contrato pasa sin errores ni advertencias: `node --test tests/contract/schema.test.mjs` pasa, y `node plugins/tcia/skills/tcia/scripts/validate.mjs plugins/tcia/skills/tcia/contract/example.tcia.json` sale con 0 y su última línea empieza por `OK:`.

**Validador**

- **A17.** `npm run test:validator` pasa.
- **A18.** Hay un fixture malo por cada código E_* de D10.3 salvo E_USAGE y E_NODE_VERSION, y cada uno produce ese código en la ruta de su `.expect.json`. La prueba falla si a algún código le falta fixture.
- **A19.** Al menos 5 guiones buenos (el del contrato y 4 más) pasan sin errores.
- **A20.** Sugerencias (D10.4): `action: "wlak"` → `E_CATALOG` con `suggestion: "walk"` (distancia OSA 1); `action: "caminar"` → `walk`; `light: "anochecer"` → `dusk`; `action: "dance"` → `approximation.to = {action: "jump", variant: "spin"}`; `kind: "dragon"` → `E_CATALOG` sin `suggestion`, con `approximation.to = null` y la nota de seres reales; `at: "centro"` → `center`. Con valores que fallan el patrón del esquema: `action: "pick up"` → `E_SCHEMA` con `suggestion: "pick_up"`; `kind: "dragón"` → `E_SCHEMA` con la misma `approximation` que `dragon`; `light: "Anochecer"` → `E_SCHEMA` con `suggestion: "dusk"`. `suggest.test.mjs` y `rules.test.mjs` pasan.
- **A21.** Conteos: 1 y 4 decisiones dan `E_COUNT_DECISIONS`; 1 y 4 opciones, `E_COUNT_OPTIONS`; 2 y 5 finales, `E_COUNT_ENDINGS`; 1 y 13 escenas principales, `E_COUNT_SCENES`; cada uno con su mensaje de D10.3.
- **A22.** Recorrido exhaustivo: un guion de 3×3×3 da `stats.paths` = 27 y 27 `outcomes`; un final tapado por otro anterior da `E_UNREACHABLE_ENDING`; una combinación sin final da `E_NO_ENDING` con esa combinación en el mensaje.
- **A23.** Globos: 80 caracteres pasa y 81 da `E_BALLOON_LENGTH`; una palabra de 25 da `E_BALLOON_WORD`; un texto de ≤ 80 caracteres que envuelto ocupa 5 líneas da `E_BALLOON_LINES`.
- **A24.** Ramas: un `rejoin` distinto de la escena principal siguiente da `E_REJOIN` con la escena esperada en el mensaje; tras la última escena solo vale `@endings`.
- **A25.** CLI: salida 0 válido, 1 inválido, 2 uso; con `--json` el objeto tiene exactamente las claves de D10.5; sin `--json` la última línea empieza por `OK:` o `FAIL:`. `cli.test.mjs` pasa.
- **A26.** Para el ejemplo del contrato, `stats.outcomes` da los 4 resultados y segundos de D9 (±0,01). `outcomes.test.mjs` pasa.

**Armador**

- **A27.** `node plugins/tcia/skills/tcia/scripts/build.mjs plugins/tcia/skills/tcia/contract/example.tcia.json --out <tmp>` escribe `<tmp>/nico-and-the-ramp.html` y `<tmp>/nico-and-the-ramp.tcia.json` y sale con 0; con un guion inválido no escribe nada y sale con 1.
- **A28.** Un guion con `</script><script>alert(1)</script>`, `<!--`, `$&`, `$'` y U+2028 en globos se arma; extraer `#tcia-script` y hacer `JSON.parse` devuelve un objeto igual al guion; dentro de ese bloque no hay `</script` ni `<!--`.
- **A29.** Armar dos veces da archivos idénticos byte a byte.
- **A30.** Con un motor sin hueco, con dos huecos o con otro `tcia-format`, sale con 1 (`E_ENGINE_TEMPLATE` o `E_ENGINE_FORMAT`) y no escribe nada.
- **A31.** El HTML armado no contiene `https://`, `src=`, `href=`, `@import` ni `url(`, y `http://` solo como `http://www.w3.org/2000/svg`. `npm run test:validator` (en `tests/build/`) pasa.

**Motor**

- **A32.** `npm run test:engine` pasa con Chrome disponible.
- **A33.** Cobertura del catálogo: cada acción×variante×esqueleto, emoción×intensidad, cara, efecto, tipo, valor de cada atributo de cada conjunto, base, pieza×variante×capa, luz, objeto, posición y altura de salto tiene entrada en `registry`, y dibujarla en Node da un árbol con al menos un `polygon` o `path`. `catalog-coverage.test.mjs` pasa.
- **A34.** En todos los árboles de A33 y en los fotogramas de A38 solo hay elementos de D13.2, ningún `url(`, `path` solo con los comandos de D13.2 (M, L, H, V, C, S, Q, T, Z; sin A), `circle` con r ≤ 14 y como mucho 3 rellenos distintos por `g[data-part]`. `svg-rules.test.mjs` pasa.
- **A35.** Aplastar y estirar (muestreo cada 1/60 s): en `jump` (todas las variantes), `fall` (todas) y `sit.flop`, en los 3 esqueletos, la anticipación llega a un `sy` mínimo en [0,75; 0,92], el despegue o impacto a un `sy` máximo en [1,08; 1,30], y `|sx·sy − 1| ≤ 0,05` siempre. `pose.test.mjs` pasa.
- **A36.** `outcomes(prepare(ejemplo, catálogo))` da los mismos 4 resultados y segundos de D9 (±0,01). `timing.test.mjs` pasa.
- **A37.** En `deciding`, `advance(10000)` no cambia el estado; `choose(5)` con 2 opciones lanza `RangeError`; `keyToOption` mapea `'1'`, `'Digit2'`, `'Numpad3'` a 0, 1, 2 y `'4'` con 3 opciones a −1; `restart()` deja variables iniciales, `choices` vacío y `playing` en la primera escena principal. `player.test.mjs` pasa.
- **A38.** Recorriendo cada 1/15 s todos los caminos del ejemplo del contrato y de los 5 ejemplos, todo `<text>` del SVG es una línea de algún `say` del guion: el motor no dibuja nombres, títulos de final ni preguntas. `draw.test.mjs` pasa.
- **A39.** `npm run check:engine` sale con 0: `assets/engine.html` es exactamente lo que genera el build y su catálogo embebido es igual al del contrato. Con Node < 22, `engine/build.mjs` sale con 2 y el mensaje de V2; `build-sync.test.mjs` prueba su comprobación con `'20.11.0'` y `'22.0.0'`.
- **A40.** `engine.html` tiene un solo `__TCIA_SCRIPT_JSON__`, las metas de D12 (incluida la CSP), cumple A31 y pesa ≤ 350 KB. `build-sync.test.mjs` pasa.

**Ejemplos e integración**

- **A41.** `examples/` tiene exactamente 5 carpetas, cada una con `<slug>.tcia.json`, `<slug>.html` y `request.txt`; `meta.lang` coincide con el idioma del pedido: dos `es`, dos `en` y una `pt` con `meta.ui`. `examples.test.mjs` pasa.
- **A42.** (Criterio pedido por el usuario) La historia pedida en español y la pedida en inglés —y las otras tres— validan sin errores y se arman: para cada `examples/<slug>/<slug>.tcia.json`, `validate.mjs` sale con 0 y `build.mjs --out <tmp>` sale con 0 y produce un HTML idéntico al confirmado. `examples.test.mjs` pasa.
- **A43.** Los 5 ejemplos juntos (las 2 historias originales y las 3 de prueba) cubren todo lo de D15: cada acción×variante, cada acción en los 3 esqueletos, cada emoción×intensidad, cada luz, base, tipo, valor de atributo (incluidos todos los colores de paleta, los accesorios de persona, los pelajes de perro y gato y los tamaños de ave), pieza×variante, capa, posición, objeto y altura de salto, al menos una vez. La cobertura se cuenta sobre los 5 porque cubrir todos los valores de aspecto necesita unos 20 personajes y las historias 3–5 admiten como mucho 18. `coverage.test.mjs` pasa.
- **A44.** Las historias 1 y 2 cumplen las acrobacias, emociones y reglas de aspecto de D15. `coverage.test.mjs` pasa.
- **A45.** Para el ejemplo del contrato y los 5 ejemplos, en cada combinación de elecciones el `Player` llega a `ended` con el final que da `outcomes`. `walk-all-paths.test.mjs` pasa.
- **A46.** Para esos mismos guiones, `stats.outcomes` del validador y `outcomes()` del motor coinciden en combinaciones, finales y segundos (±0,01). `consistency.test.mjs` pasa.
- **A47.** Con Chrome o Chromium, cada HTML de `examples/`, abierto con `#tcia=auto:…` en un conjunto de combinaciones que cubre cada opción y cada final, termina con `data-tcia-state="ended"`, el `data-tcia-ending` esperado, `data-tcia-errors="0"` y los textos de botón del idioma (en `pt`, los de `meta.ui`). `browser.test.mjs` pasa; si se salta por falta de Chrome, el criterio queda **no cumplido**.
- **A48.** (Manual, con el visto bueno del usuario; capturas en una carpeta temporal fuera del repo, borradas al terminar) A 1280×720, 1920×1080 y 1280×900, con `#tcia=stop:…`: pantalla de título, un globo de 80 caracteres, una decisión de 2 y otra de 3 botones, y la pantalla final. Se ve el lienzo 16:9 con franjas cuando la ventana no es 16:9, textos legibles dentro del lienzo, botones numerados, personajes de siluetas suaves con facetado leve, sin costuras ni degradados, y en la pantalla final solo «Empezar de nuevo» o «Start over».
- **A49.** (Manual) Enter inicia desde el título; 1/2/3 eligen; Tab muestra un foco visible; una decisión abierta espera más de 2 minutos sin avanzar; al cambiar de pestaña la animación se pausa y al volver sigue.
- **A50.** En modo automático a 1920×1080, `data-tcia-frame-ms` de `test-people-actions` es menor que 12 en la máquina del auditor (se anota cuál).

**La skill de punta a punta** (manual, en una sesión con `claude --plugin-dir ./plugins/tcia`, pedidos de D4)

- **A51.** Con `es-completo`, Claude no pregunta nada, escribe `<slug>.tcia.json`, valida hasta `ok`, arma e informa en español: ruta del HTML, aproximaciones, lo inventado, mapa de decisiones y tabla de finales con duraciones; los globos y botones salen en español.
- **A52.** Con `en-fantasia`, Claude propone un ser real en lugar del dragón y una aproximación para la patineta, las anota en `notes.approximations` y en el informe, y la historia sale en inglés.
- **A53.** Con `es-una-escena`, Claude pregunta por más escenas y no inventa escenas principales.
- **A54.** Con los dos pedidos de `activación`, sin nombrar la skill, Claude la carga sola en ambos idiomas.

**Comedia en todo momento** (anexo de §1)

- **A55.** (Motor 1) Ninguna acción es lineal ni rígida. Para cada acción × variante × esqueleto, con la pose muestreada cada 1/60 s durante la duración por defecto: (a) anticipación, `sy` < 0,97 en el primer 25 %; (b) exageración, `sy` > 1,03 después; (c) rebote y asentamiento, en el último 20 % `sy` cruza 1 al menos una vez y termina en [0,99; 1,01]; (d) `|sx·sy − 1| ≤ 0,05` siempre; (e) en `walk`, `run` y `jump` con `to`, la x de la raíz se aparta de la interpolación lineal al menos un 3 % del recorrido (acelera y frena). `pose.test.mjs` pasa.
- **A56.** (Motor 2) Efectos secundarios: en los fotogramas dibujados en Node aparecen `g[data-fx="dust"]` al arrancar `run`, al aterrizar `jump` y al terminar `fall`; `speed_lines` en `run` y en `jump` con flip, backflip, spin o cartwheel; `dizzy` (estrellas o pajaritos girando sobre la cabeza) después de cada variante de `fall`; `skid` al frenar `run`. En la anticipación de `jump` con `height: high` la x de la raíz oscila al menos 2 veces con amplitud ≥ 3 px. El rebote al aterrizar lo cubre A55 (c). `draw.test.mjs` y `pose.test.mjs` pasan; el auditor los ve además al reproducir un ejemplo (A49).
- **A57.** (Motor 3) Reposo vivo: un personaje sin beat durante 10 s simulados (cada 1/60 s), en cada esqueleto, respira con rebote (`sy` oscila con el periodo `breathPeriod` y amplitud ≥ `breathScale`), parpadea al menos 2 veces (ojos cerrados en 2 intervalos separados), mira en al menos 2 direcciones distintas y hace al menos un tic (una articulación se mueve ≥ 5° y vuelve). Dos corridas dan los mismos fotogramas. `pose.test.mjs` pasa.
- **A58.** (Motor 4) Emociones de caricatura desde la intensidad 1: para cada emoción distinta de `neutral`, en los 3 esqueletos, la cara de intensidad 1 cambia el alto o el ancho de los ojos o de la boca al menos un 25 % respecto de `neutral`. `draw.test.mjs` pasa, y con `TCIA_SHEET=<carpeta temporal fuera del repo>` escribe una lámina SVG de 6 emociones × 3 intensidades × 3 esqueletos. El auditor revisa la lámina con el visto bueno del usuario y confirma que todas, `sad` y `scared` incluidas, se leen como caricatura cómica y no como angustia realista; después borra la lámina.
- **A59.** (Motor 5) Pausa antes de cada reacción: en cada beat de reacción y en cada beat con acción que cambia la emoción, la cara nueva y los efectos `burst` empiezan entre 0,15 y 0,3 s después del inicio del beat. En los beats de reacción, durante esa pausa la raíz queda quieta: su posición medida en la escena completa (coordenadas del viewBox, no relativas al personaje) no se mueve más de 1 px, con los efectos `loop` de la emoción anterior congelados mientras dura la pausa. La prueba cubre, entre otros, reacciones que parten de `angry` con intensidad 3 y de `scared` con intensidad 3 (con `shake` y `tremble` activos). La duración del beat no cambia: A26 y A36 siguen dando las mismas cifras. `pose.test.mjs` y `timing.test.mjs` pasan.
- **A60.** (Motor 6) Pantallas juguetonas sin extras: en `engine.html`, los botones de decisión y el de final entran con una animación cuyo `@keyframes` lleva una `scale` mayor que 1, con un desfase entre los botones de decisión; mientras se espera siguen el reposo vivo (A57) y los efectos `loop`. Con `#tcia=stop:deciding` la superposición tiene solo 2–3 botones, cada uno con su número y su `label`, y con `#tcia=stop:ended` un solo botón con `ui.restart`, sin otro texto ni elemento visible. `build-sync.test.mjs` y `browser.test.mjs` pasan; el auditor ve el rebote en A49.
- **A61.** (Motor 7) Nada de violencia real: el conjunto de valores `data-fx` que aparecen en todos los dibujos de A33 y A38 es exactamente `dust`, `speed_lines`, `dizzy`, `skid` más los efectos del catálogo (`draw.test.mjs` pasa). En la lámina de A58 y al reproducir los ejemplos (A49), el auditor confirma que ninguna caída deja heridas, sangre ni vendas, y que no hay armas ni golpes entre personajes.
- **A62.** (Skill 1 y 5) Gag en toda escena: las «Hard rules» de SKILL.md exigen al menos un gag (físico, de reacción o una frase) en toda escena principal, de rama y de final. El auditor recorre todas las escenas de los 5 guiones de `examples/` y anota el gag de cada una (tipo y número de beat, desde 1 como en el informe); una escena sin gag es incumplimiento.
- **A63.** (Skill 2 y 5) Globos, finales y tono: SKILL.md y `comedy-guide.md` piden globos cortos y con gracia, finales «malos» también graciosos y humor para toda la familia. El auditor lee todos los `say` de los 5 ejemplos y confirma: ninguno es una explicación larga sin remate; cada final malo para el protagonista termina en gag, no en castigo ni en tristeza seca; no hay insultos, burlas a grupos, contenido adulto ni violencia real.
- **A64.** (Skill 3) Guía de comedia: existe `plugins/tcia/skills/tcia/references/comedy-guide.md`, en inglés, con una tabla que traduce gags físicos, de reacción y de frase a ids del catálogo (acción, variante, emoción, intensidad y efectos que se verán), y con las reglas del anexo (triste y asustado en clave cómica, finales malos graciosos, humor familiar, nada de violencia real). El auditor comprueba que todos los ids de la tabla existen en `catalog.json`. SKILL.md la cita con `${CLAUDE_SKILL_DIR}` en «Files to read»; `docs.test.mjs` comprueba que el archivo existe y que SKILL.md lo cita.
- **A65.** (Skill 4) Repaso de gags e informe: el «Workflow» de SKILL.md tiene, antes de armar, un paso que repasa escena por escena que haya al menos un gag y corrige el guion si falta; `references/report.md` trae la lista de escenas con su gag. En las pruebas manuales A51 y A52, el informe nombra el gag de cada escena (principal, de rama y de final). Comprobación: lectura de SKILL.md y de `report.md`, y de los informes de A51 y A52.

**Composición** (anexo de §1). Las pruebas corren sobre el ejemplo del contrato y los 5 `examples/*`; las capturas son las de A48.

- **A66.** (R1) Para cada decisión y cada final, abiertos en Chrome con `#tcia=auto:…;stop:deciding@n` o `#tcia=auto:…;stop:ended` (una corrida por decisión y otra por final), ninguna caja de `data-tcia-boxes.buttons` se cruza con ninguna caja de cuerpo o de cabeza de `actors`. `browser.test.mjs` pasa. En las capturas, los botones no tapan a ningún personaje.
- **A67.** (R2) Para cada beat con `say` (de escenas principales, de rama y de final), muestreando cada 1/15 s durante todo el beat: el motor evaluó al menos 2 posiciones candidatas; la caja del globo, con su cola, no se cruza con la caja de la cabeza de ningún personaje en escena; su cruce con la caja del cuerpo de cualquier personaje no pasa del tope `MAX_BODY_OVERLAP` que exporta el motor (la prueba lo imprime y el auditor anota su valor y su unidad en §9); el globo queda dentro del lienzo; y la punta de la cola está más cerca de la cabeza de quien habla que de cualquier otra cabeza, y a no más de 60 px de ella. `composition.test.mjs` pasa. En la captura del globo de 80 caracteres no queda tapada ninguna cara.
- **A68.** (R3) En cada fotograma (cada 1/15 s) de todos los caminos: en el árbol SVG, cada grupo de personaje va después de todos los grupos de piezas, de cualquier capa; los actores de los beats en curso van después de los demás personajes; y ninguna caja de efecto de un personaje (`data-fx` y efectos del catálogo) se cruza con la caja de la cabeza de otro. `composition.test.mjs` pasa. En las capturas, ninguna pieza tapa a un personaje.
- **A69.** (R4) En cada fotograma de todos los caminos en que un personaje está acostado o sentado en el suelo (sin asiento), y en la pose final de cada variante de `fall` para cada esqueleto, cada forma de cabeza y cada peinado: el punto más bajo de la cabeza, de la cara y del pelo queda en y ≤ 900, la línea del suelo, con tolerancia de 2 px. `composition.test.mjs` pasa. Con `TCIA_SHEET`, la lámina de A58 incluye además esas poses finales de `fall`, y el auditor confirma que la cara se ve entera y el pelo no atraviesa el suelo.
- **A70.** (R5) Con `#tcia=stop:title`, `data-tcia-boxes.actors` tiene a todos los personajes de `characters`, con los pies en la misma línea (y = 900 ± 1), ordenados por x, sin que sus cajas se crucen y dentro del lienzo; en Node, el fotograma de título los tiene de pie y sin acción, solo en reposo. `browser.test.mjs` y `composition.test.mjs` pasan. Captura del título revisada.
- **A71.** (R6) Con `#tcia=stop:deciding@n` para cada decisión, y para un fixture del motor cuyas etiquetas miden 1 y 32 caracteres, todas las cajas de `buttons` de la decisión tienen la misma altura (diferencia ≤ 1 unidad del viewBox). `browser.test.mjs` pasa. En las capturas de decisiones de 2 y de 3 botones, los botones tienen la misma altura.

**Estilo afinado y fluidez** (anexo de §1). Salvo que se diga otra cosa, las pruebas muestrean a 60 fps todos los caminos del ejemplo del contrato y de los 5 `examples/*`, y la lámina es la de `TCIA_SHEET` (A58).

- **A72.** (1, uniones integradas) En todas las poses muestreadas, más las de la cobertura de A33: los extremos conectados de cada cadena del esqueleto (torso–brazo, torso–pierna, torso–cuello–cabeza, cuerpo–cola, cuerpo–patas y los segmentos entre sí) no se separan, es decir, coinciden con la precisión con que se escriben en el SVG; la raíz de cada extremidad queda dentro de la silueta del torso; y brazo, pierna, cuello, cola y patas son cada uno un solo elemento de silueta, que cambia entre fotogramas. `fluidity.test.mjs` (o `pose.test.mjs`) pasa. La lámina incluye poses con codo y rodilla doblados 90° o más en los 3 esqueletos, y el auditor confirma uniones redondeadas, sin huecos ni escalones.
- **A73.** (2, puntos que conectan) En los árboles SVG de A33 y en los fotogramas muestreados: los vértices de cada unión declarada por el esqueleto se escriben con las mismas cifras en las dos partes que se tocan; toda parte facetada tiene debajo su silueta rellena con el tono base, o facetas con trazo de su mismo color; y todo contorno tiene `stroke-linejoin="round"` y `stroke-linecap="round"`. `svg-rules.test.mjs` pasa. En las capturas de A48 ampliadas al 200 %, el auditor no ve costuras entre facetas ni entre partes.
- **A74.** (3, menos facetado) El motor exporta una sola constante `FACET_CONTRAST` entre 0 y 1, y todos los tonos de faceta salen de ella: dibujar con contraste 0 deja un solo relleno por parte, y con `FACET_CONTRAST` los rellenos de faceta quedan entre el tono base y los tonos claro y de sombra de la paleta. Las partes redondas tienen 16 vértices o más, o usan curvas. Sigue valiendo A34 (sin degradados). `draw.test.mjs` pasa; el auditor anota el valor de `FACET_CONTRAST` en §9 y confirma en la lámina siluetas suaves con facetado leve.
- **A75.** (4, mezcla) El motor exporta `BLEND_MS`, entre 150 y 250. En cada frontera entre beats y entre acciones, la prueba revisa toda la ventana de `BLEND_MS`, fotograma a fotograma a 60 fps, para cada personaje en escena, actúe o no en el beat que empieza: la mezcla parte de la última pose que se dibujó de ese personaje (el primer fotograma de la ventana no se aleja de ella más de lo que permite A76) y sus articulaciones pasan por valores intermedios hasta la pose de llegada, sin saltos ni picos según A76. Cada cambio de emoción interpola la cara (alto y ancho de ojos y boca pasan por valores intermedios) durante `BLEND_MS`, empezando al terminar la pausa de A59. A26, A36 y A59 siguen pasando. `fluidity.test.mjs` pasa.
- **A76.** (5, continuidad) `tests/engine/fluidity.test.mjs` muestrea a 60 fps todos los caminos del ejemplo del contrato y de los 5 ejemplos, en coordenadas del viewBox, salvo en un cambio de escena: (a) ninguna articulación avanza más de `MAX_JOINT_STEP_PX` entre dos fotogramas seguidos; (b) prueba de picos: ningún paso de una articulación supera `SPIKE_RATIO` veces la mediana de los pasos de esa articulación en los ±3 fotogramas vecinos, salvo que el paso sea menor que el mínimo absoluto `SPIKE_MIN_PX`. El motor fija y exporta `MAX_JOINT_STEP_PX`, `SPIKE_RATIO` y `SPIKE_MIN_PX`; la prueba los imprime y el auditor los anota en §9.
- **A77.** (6, pies que no patinan) En los beats de `walk` y `run`, de todas las variantes y en los 3 esqueletos, en cada fotograma en que un pie (o pata) está apoyado en el suelo, su velocidad horizontal en coordenadas del viewBox no pasa del tope que exporta el motor; y en cada ciclo de paso, lo que avanza la raíz coincide con el largo del paso con un margen de ±15 %. `fluidity.test.mjs` pasa; la prueba imprime el tope y el auditor lo anota en §9.
- **A78.** (Piernas) El motor exporta `MAX_REST_KNEE_DEG`, con un valor de 36° o menos (36° equivale a la pierna al 95 % de su largo), y `TURN_HOP_S`. Una prueba de `tests/engine/` cuyo nombre incluye «A78» comprueba, en los esqueletos con rodilla (`biped` y `quadruped`): (1) en el fotograma de título (A70) del ejemplo del contrato y de los 5 ejemplos, todas las rodillas de todos los personajes (las dos de una persona, las cuatro de un cuadrúpedo) quedan en `MAX_REST_KNEE_DEG` o menos; (2) en reposo estable, para cada emoción con cada intensidad (1, 2 y 3) salvo `scared`, muestreando a 60 fps durante 10 s, pasa lo mismo en todos los fotogramas; (3) en `walk`, salvo la variante `sneak`, durante todo el beat (arranque, pasos y final), la rodilla de la pierna apoyada queda en `MAX_REST_KNEE_DEG` o menos en todos los fotogramas, y en cada ciclo de paso la rodilla de la pierna que avanza se dobla más que el tope. No cuentan para el tope, y son las únicas exclusiones: `scared`; `walk.sneak`; los fotogramas de la anticipación explícita de un `jump`; el salto en el sitio al girar (`TURN_HOP_S`), que es un giro sin avanzar y no un paso; y el asentamiento de A55 en los ~0,25 s que siguen al fin de un beat de `walk` o `run` (rebote de llegada, que puede pasar del tope por un instante; se midió hasta 43° tras una carrera). La prueba imprime `MAX_REST_KNEE_DEG`, `TURN_HOP_S` y la ventana de asentamiento que excluye; el auditor los anota en §9 y revisa la captura del título. El rebote cómico se conserva (A57 sigue pasando).
- **A79.** (Cola del globo) En cada fotograma de cada beat con `say` de todos los caminos, la cola del globo mide como mucho `MAX_TAIL_PX`, que fija y exporta el motor; cuando mantener ese largo exige mover el globo porque quien habla se desplaza, el globo lo sigue y su posición pasa la prueba de picos de A76 (con los mismos `SPIKE_RATIO` y `SPIKE_MIN_PX`). A67 sigue pasando. `composition.test.mjs` pasa; la prueba imprime `MAX_TAIL_PX` y el auditor lo anota en §9.

---

## 9. Auditoría y entrega

Se llena al terminar; no se escribe por adelantado. Además de lo que pide la plantilla, el auditor
anota aquí el valor de cada constante que fija el motor y que imprimen las pruebas:
`MAX_BODY_OVERLAP` (A67), `FACET_CONTRAST` (A74), `BLEND_MS` (A75), `MAX_JOINT_STEP_PX`,
`SPIKE_RATIO` y `SPIKE_MIN_PX` (A76), el tope de velocidad del pie apoyado (A77), `MAX_REST_KNEE_DEG`, `TURN_HOP_S` y la ventana de asentamiento
excluida (A78) y `MAX_TAIL_PX` (A79).
