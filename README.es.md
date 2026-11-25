# TCIA (Taller Creativo IA Animation)

## Qué es

TCIA es una skill de Claude Code que convierte una idea de historia en **un solo archivo .html**: una animación 2D lowpoly de caricatura, con globos de diálogo y 2 o 3 decisiones interactivas que llevan a 3 o 4 finales. Tú das la trama, las escenas y los personajes; Claude escribe un guion JSON corto, un validador incluido lo revisa y un motor fijo lo dibuja. El estilo es una caricatura geométrica y plana: personajes y escenarios lowpoly de siluetas suaves, partes bien unidas y un facetado leve, sin degradados, que se mueven con acción exagerada y acrobática, y comedia en cada escena.

Read in English: [README.md](README.md).

## Ejemplos

`examples/` trae cinco historias. Cada carpeta tiene el guion (`<slug>.tcia.json`), la animación armada (`<slug>.html`) y el pedido que la produjo (`request.txt`). Abre cualquier `examples/*/*.html` con doble clic en un navegador de escritorio; funciona sin internet.

| Carpeta | Idioma | Qué muestra |
|---|---|---|
| `rulo-salta-la-ciudad` | Español | Un niño temerario, su hermana y su perro en la ciudad y el parque: 5 escenas, 3 decisiones, 4 finales |
| `rulo-and-the-mountain-race` | Inglés | El mismo niño corre contra una amiga montaña arriba: 4 escenas, 2 decisiones, 3 finales |
| `test-people-actions` | Español | Historia de prueba: todas las personas, acciones, variantes, emociones y objetos |
| `test-animals-places` | Inglés | Historia de prueba: perros, gatos y un ave en todos los lugares, luces y piezas |
| `test-flow-max` | Portugués | Historia de prueba: 12 escenas, 3 decisiones de 3 opciones (27 caminos), 4 finales |

## Instalar

```text
# dentro de Claude Code
/plugin marketplace add SOLARE-TI/tcia
/plugin install tcia@tcia

# o desde la terminal
claude plugin marketplace add SOLARE-TI/tcia
claude plugin install tcia@tcia
```

TCIA funciona donde Claude pueda correr sus scripts de Node.js. Elige tu lugar:

### Claude Code en la terminal

Usa los comandos de arriba. Dentro de una sesión, `/plugin install tcia@tcia` abre la ficha del plugin: elige **Install for you** para tenerlo en todos tus proyectos. El comando de la terminal lo instala para ti (alcance de usuario) de una vez. Después escribe `/` y busca `/tcia:tcia`, o corre `claude plugin list`.

- **Actualizar.** Las actualizaciones de este marketplace no son automáticas, salvo que las actives (`/plugin`, pestaña **Marketplaces**, elige `tcia`). Para actualizar ya, corre `claude plugin update tcia@tcia`, o abre `/plugin`, pestaña **Installed**, `tcia`, **Update now**.
- **Desinstalar.** Corre `claude plugin uninstall tcia@tcia`. Para olvidar también el marketplace, corre `claude plugin marketplace remove tcia` (desinstala también sus plugins).

### Claude Code en la app de escritorio (pestaña Code)

Las sesiones locales de la app de escritorio leen la misma configuración que la terminal: si instalaste TCIA para ti (alcance de usuario) en la terminal, ya está ahí. Para instalarlo desde la app: en una sesión local, haz clic en **+** junto al cuadro del mensaje y elige **Add plugins** (o **Plugins** y luego **Browse plugins**), elige `tcia` y un alcance. El navegador de plugins muestra los plugins de los marketplaces que ya agregaste, así que primero agrega `SOLARE-TI/tcia` con `claude plugin marketplace add SOLARE-TI/tcia` en una terminal. Para activarlo, desactivarlo o desinstalarlo después: **+**, **Plugins**, **Manage plugins**.

### Claude Code en el navegador (claude.ai/code)

Las sesiones en la nube no ven los plugins instalados en tu computador y no agregan los marketplaces que liste el `.claude/settings.json` de un repositorio. Agrega TCIA a tu cuenta de claude.ai:

1. Abre [claude.ai/customize/plugins](https://claude.ai/customize/plugins).
2. Elige **Add**, luego **Add marketplace**, y escribe `SOLARE-TI/tcia`.
3. Elige el plugin `tcia` y agrégalo.
4. Empieza una sesión nueva en la nube.

Los entornos en la nube ya traen Node.js 22 en el `PATH`.

### La app de Claude (chat en claude.ai y en la app de escritorio)

**No probado.** Todo lo de esta sección sigue la documentación oficial, pero nadie lo ha probado todavía con TCIA: instalarlo como plugin desde **Customize**, que la skill aparezca en Cowork, subir el .zip y correrlo en el chat.

Dos formas, las dos desde **Customize** en claude.ai o en la app de escritorio:

- **Como plugin (no probado)**: en **Customize > Plugins**, elige **Add**, luego **Add marketplace**, escribe `SOLARE-TI/tcia`, elige `tcia` y agrégalo. Según la documentación, el plugin queda en tu cuenta, así que su skill debería estar también en Cowork y en Claude Code con la misma cuenta.
- **Como archivo de skill (no probado)**: descarga [tcia-skill.zip](https://github.com/SOLARE-TI/tcia/releases/latest/download/tcia-skill.zip) (una carpeta `tcia/` con `SKILL.md` adentro). El enlace funciona desde que exista el release `v0.1.0`. En **Customize > Skills**, haz clic en **+**, luego **Create skill**, luego **Upload a skill**, elige el .zip y activa la skill.

En el chat, TCIA necesita la ejecución de código: en los planes individuales, activa **Code execution and file creation** (**Create and edit files** en el diseño nuevo) en **Settings > Capabilities**; en los planes Team y Enterprise la activa un Owner para toda la organización. También necesita Node.js 22 o más nuevo dentro de ese entorno de ejecución, y la documentación no dice qué versión de Node.js trae: eso **no está garantizado ni probado**. Si el validador no puede correr ahí, usa Claude Code.

## Usar

Pídelo con tus palabras, en español o en inglés, o llama a `/tcia:tcia <idea>` en Claude Code (`/tcia` también sirve si ningún otro comando se llama así). En el chat, describe la historia o escribe `/` y elige la skill `tcia`:

> Crea una animación con decisiones: Tomás, un niño temerario con casco verde, y su perra Luna. Escena 1: en el parque, Tomás ve una rampa nueva. Escena 2: al atardecer, intenta el salto.

Claude hace una sola pregunta si falta algo esencial (la trama, al menos 2 escenas, los personajes). Después escribe `<slug>.tcia.json`, lo valida, arma `<slug>.html` en tu carpeta de trabajo e informa: dónde quedaron los archivos, qué tuvo que aproximar, qué inventó, el mapa de decisiones, qué elecciones llevan a cada final, cuánto dura la historia y el gag de cada escena.

## Qué se puede pedir

- **Personajes**: solo seres reales. Hombre, mujer, niño, niña, anciano, anciana (con altura, complexión, piel, forma de cabeza, pelo, ropa, colores y un accesorio), perro, gato y ave. Como mucho 6 por historia.
- **Lugares**: ciudad, bosque, playa, montaña, parque, campo, una habitación o un escenario vacío, decorados con 34 piezas (árboles, rocas, edificios, casas, faroles, bancas, muebles, agua, arena, nubes…).
- **Luz**: día, atardecer, anochecer o interior.
- **Acciones**: caminar, correr, saltar, saludar, hablar, señalar, sentarse, recoger, entregar, caer, abrazar y pensar, con 34 variantes (voltereta, mortal hacia atrás, giro, rueda, salto de tijera, carrera a toda velocidad, de puntillas, lanzar, desmayo…).
- **Emociones**: alegre, triste, enojado, sorprendido, asustado y neutral, en tres intensidades y siempre de caricatura: ojos que se salen, mandíbula que cae, vapor, lágrimas en chorro.
- **Objetos**: pelota, libro, flor, carta, llave, manzana, regalo, taza, mapa y celular.

Lo que no está en este catálogo cerrado se aproxima a lo más parecido y Claude te lo avisa (andar en patineta se vuelve una carrera rápida; un caballo, un perro grande). Los seres fantásticos y los robots se cambian por una persona o un animal real; si es central en tu historia, Claude pregunta antes.

## Límites

- Solo navegadores de escritorio: un escenario 16:9 que se escala a la ventana. Sin diseño para celular ni tableta.
- Sin audio, sin narrador, sin subtítulos; los personajes hablan y piensan en globos.
- Cámara lateral fija: sin paneos, zoom ni cortes dentro de una escena.
- Catálogo cerrado: no se agregan acciones, tipos ni piezas al pedir.
- De 2 a 12 escenas principales (las tuyas: nunca se agregan ni se quitan), 2 o 3 decisiones de 2 o 3 opciones, 3 o 4 finales.
- Las elecciones se recuerdan y deciden el final; las ramas siempre vuelven a la historia principal.

## Requisitos

- Claude Code (terminal, app de escritorio o navegador), o la app de Claude con la ejecución de código activada.
- Node.js 22 o más nuevo donde Claude corre los scripts: en el PATH para Claude Code en tu computador; las sesiones en la nube ya lo traen; en el chat de claude.ai no está garantizado (ver Instalar). El validador y el armador son scripts de Node sin dependencias.
- Un navegador de escritorio para ver el resultado.

## Cómo funciona

1. **Guion.** Claude solo escribe un guion JSON con un formato fijo: personajes, escenarios, escenas hechas de beats (quién hace qué, dónde, con qué emoción y qué globo), decisiones y finales.
2. **Validador.** `scripts/validate.mjs` revisa el formato, los ids del catálogo, los textos, la puesta en escena de cada escena y todas las combinaciones de elecciones, y explica cada problema para que Claude lo corrija.
3. **Armador.** `scripts/build.mjs` inyecta el guion válido en el motor y escribe `<slug>.html` y `<slug>.tcia.json`.
4. **Motor.** Una plantilla HTML fija, con JavaScript y SVG en línea, que dibuja y anima la historia. Nunca cambia de una historia a otra y no necesita red.

## Contribuir

Lee [CLAUDE.md](CLAUDE.md) (en inglés): reglas, dónde está cada cosa y cómo correr las pruebas.

## Licencia

MIT, © 2026 Solare S.A.S. Ver [LICENSE](LICENSE).
