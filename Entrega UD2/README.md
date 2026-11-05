# Entrega UD2 · Generación de interfaces naturales de usuario

Desarrollo de Interfaces (DAM). Base: la última versión de la plantilla del CRM (**V0.0.14**), copiada en `CRM/`.

- **Dentro de la interfaz:** comandos por voz y dictado en el CRM.
- **En una carpeta aparte (`Ejercicios/`):** gestos, detector facial, comandos por gestos y AR/VR.

## Arrancar

Todo es HTML, CSS y JavaScript sin compilar. Necesita un servidor (los módulos ES y la cámara no funcionan abriendo el archivo):

```bash
cd "Entrega UD2"
python3 -m http.server 8000
```

y entra en `http://localhost:8000`. La portada enlaza el CRM y los ejercicios.

- **Navegador:** Chrome o Edge actualizados. El reconocimiento de voz de Chrome usa el servicio de Google, así que necesita internet; Firefox no tiene reconocimiento de voz (los comandos se pueden escribir).
- **Cámara y micrófono:** solo en `localhost` o `https`. Para probar en el móvil o en unas gafas VR hay que servirlo por https (GitHub Pages o un túnel tipo `ngrok http 8000`).
- **Internet:** los ejercicios 02, 03 y 04 cargan MediaPipe, sus modelos y A-Frame desde CDN (versiones fijadas). La imagen de la cámara se procesa en el navegador y no se envía a ningún sitio.
- **WebGL:** MediaPipe y A-Frame lo necesitan. Si el navegador tiene desactivada la aceleración gráfica, la página lo avisa.

## Criterios de evaluación (RA2)

| Criterio | Enunciado | Dónde se cumple |
| --- | --- | --- |
| a | Herramientas de aprendizaje automático para interfaces | Web Speech API (reconocimiento y síntesis de voz), MediaPipe Tasks Vision (Face Landmarker, Gesture Recognizer, Pose Landmarker: modelos ya entrenados que se ejecutan en el navegador con WebAssembly y GPU) y WebXR. Ver [Herramientas](#herramientas). |
| b | Interfaz natural con las herramientas disponibles | El CRM por voz y los cuatro ejercicios. |
| c | Reconocimiento de voz para implementar acciones | CRM: comandos de voz y dictado. |
| d | Detección del movimiento del cuerpo | Ejercicio 03 (posturas del cuerpo y barrido de la mano en el aire) y ejercicio 01 (agitar el móvil). |
| e | Detección de partes del cuerpo | Ejercicio 02 (cara, ojos, boca y giro de cabeza) y ejercicio 03 (manos y dedos, cursor con pinza). |
| f | Realidad aumentada en la interfaz | Ejercicio 04: AR con WebXR (hit-test sobre superficies reales) o sobre la imagen de la cámara, y sala VR. |

## 1. CRM con voz y dictado (`CRM/`)

### Comandos de voz

Micrófono en la barra superior o tecla **V**. Un panel muestra en vivo lo que se va entendiendo, la orden reconocida y la respuesta. Se entiende **español e inglés** a la vez. Si el navegador no reconoce la voz, el mismo panel deja **escribir el comando**.

| Grupo | Ejemplos |
| --- | --- |
| Navegar | «Ir a clientes», «abre ventas», «informes», «atrás» |
| Ficha de cliente | «Abre Talleres Arrieta», «ficha de Clínica Norte» (busca el nombre aunque no se diga entero) |
| Crear | «Nuevo cliente», «nueva factura», «registrar cobro», «nueva tarea» |
| Tareas de una vez | «Recuérdame llamar a Clínica Norte mañana», «crea una tarea revisar la propuesta el viernes», «remind me to send the quote in 3 days» |
| Buscar | «Busca Valencia» (abre la búsqueda con el texto) |
| Preguntar | «¿Cuánto hemos facturado este mes?», «pregunta al asistente quién debe más» (las preguntas van al asistente del CRM) |
| Resumen hablado | «¿Qué tengo hoy?» (lee tareas, atrasadas y la próxima reunión) |
| Preferencias | «Modo oscuro», «modo claro», «oculta los importes», «en inglés» |
| Exportar | «Exporta los clientes», «exporta el informe», «imprime» |
| Control | «Cerrar», «para de escuchar», «ayuda» |

En **Ajustes → Voz**: respuestas habladas (síntesis de voz) y escucha continua (sigue escuchando tras cada orden hasta decir «para»). La ayuda de comandos está en el panel y en «Atajos de teclado».

### Dictado

Botón de micrófono dentro de los campos de texto: nota del cliente, alta de cliente, descripción de tarea, alta rápida de tareas, conceptos de factura, motivo y concepto de la rectificativa, búsqueda y pregunta al asistente.

- Escribe donde está el cursor, con espacios y mayúsculas al empezar frase.
- Puntuación hablada: «coma», «punto», «punto y coma», «dos puntos», «abre/cierra interrogación», «nueva línea», «punto y aparte»…
- Órdenes: «borrar todo», «borra la última palabra», «enviar» (envía el formulario), «terminar dictado».
- Mientras se dicta, el texto provisional se ve en el panel; al cerrarse cada frase pasa al campo y lanza el mismo evento que el teclado (recalcula los totales de la factura, filtra la búsqueda, etc.).

### Código

```text
CRM/js/voice/speech.js       envoltorio de la Web Speech API (escuchar y hablar), sin dependencias
CRM/js/voice/commands.js     gramática: frase → orden { type, … } (función pura)
CRM/js/voice/dictation.js    puntuación hablada e inserción en el campo (funciones puras)
CRM/js/voice/controller.js   une escucha, gramática y acciones del CRM
CRM/js/components/voice.js   micrófono de la barra, panel de escucha, botón de dictado y ayuda
CRM/tests/voice.test.mjs     pruebas unitarias (node --test CRM/tests/voice.test.mjs)
```

Cambios en la plantilla: integración en `main.js` (acciones, atajo V, formulario del panel), estado `voice` / `voiceReplies` / `voiceContinuous` en `data/state.js`, sección Voz en Ajustes, botón de dictado en `field()` (`components/ui.js`, con el atributo `data-dictate`), traducciones en `i18n/en.js` y estilos al final de `css/styles.css`.
También `lib/morph.js`: ahora solo sobrescribe un campo si cambia el valor pintado, así no se pierde lo escrito o dictado al pulsar otro botón.

## 2. Ejercicios (`Ejercicios/`)

Cada ejercicio es una página independiente que reutiliza los tokens de diseño, el logo y los datos de ejemplo del CRM (`Ejercicios/shared/`). Todos tienen alternativa con botones o teclado.

### 01 · Gestos (`01-gestos/`)

Bandeja de seguimiento de clientes como tarjetas, con un reconocedor de gestos propio sobre **Pointer Events** (mismo código para dedo, ratón y lápiz) en `gestures.js`.

| Gesto | Acción |
| --- | --- |
| Deslizar a la derecha / izquierda / arriba | Contactado / posponer / urgente |
| Doble toque | Girar la tarjeta y ver contactos |
| Pulsación larga | Menú contextual (llamar, correo, nota) |
| Pellizcar y girar con dos dedos | Ampliar y rotar el gráfico (Ctrl/Mayús + rueda en el ordenador) |
| Agitar el móvil (acelerómetro) | Deshacer |

### 02 · Detector facial (`02-detector-facial/`)

**MediaPipe Face Landmarker**: 478 puntos de la cara y 52 expresiones (blendshapes), hasta 3 caras.

| Si detecta… | El CRM… |
| --- | --- |
| Nadie delante 2 s | Oculta las cifras |
| Dos caras o más | Oculta las cifras y avisa (alguien mira por encima del hombro) |
| Giro de cabeza a un lado | Cambia de cliente |
| Sonrisa 1 s | Sube la satisfacción del cliente |
| Doble parpadeo | Abre o cierra el detalle |
| Boca abierta 1 s | Lee el cliente en voz alta |

### 03 · Comandos por gestos (`03-comandos-gestos/`)

Embudo de ventas que se mueve sin tocar nada. Cada gesto se mantiene un instante para confirmarse (anillo de progreso), así no se dispara por accidente.

- **Manos** (Gesture Recognizer): ☝️ siguiente, ✌️ anterior, 👍 avanzar etapa, 👎 retroceder, ✋ detalle, ✊ deshacer, 🤟 cambiar tema. Además, **cursor aéreo** con el índice y clic con **pinza** (índice y pulgar), y **barrido en el aire** para saltar de columna.
- **Cuerpo** (Pose Landmarker): brazo derecho arriba = siguiente, brazo izquierdo = anterior, los dos por encima de la cabeza = venta ganada, brazos en cruz = deshacer, inclinarse = avanzar o retroceder etapa.

### 04 · AR / VR (`04-realidad-aumentada-vr/`)

**WebXR** con **A-Frame 1.5** (sobre Three.js). Los textos 3D se pintan en un canvas con la tipografía de la marca (componente `canvas-panel`).

- **VR (`vr.html`):** sala con la facturación de 12 meses en barras 3D (facturado y cobrado), el embudo de ventas (pulsar una oportunidad la avanza de etapa y actualiza el objetivo) y paneles de indicadores. Mandos con láser, cursor de mirada en las gafas, toque en el móvil o ratón y WASD en el ordenador.
- **AR (`ar.html`):** tótem con los indicadores. Con WebXR (Android con ARCore, gafas con passthrough) se coloca sobre la mesa o el suelo tocando la superficie (hit-test). Sin WebXR se dibuja sobre la imagen de la cámara trasera y se orienta con el giroscopio.

## Herramientas

| Herramienta | Qué hace | Dónde |
| --- | --- | --- |
| Web Speech API · SpeechRecognition | Voz a texto (modelo de Google en Chrome) | CRM |
| Web Speech API · speechSynthesis | Texto a voz | CRM, ejercicio 02 |
| MediaPipe Face Landmarker | Malla facial y expresiones | Ejercicio 02 |
| MediaPipe Gesture Recognizer | 21 puntos por mano y 7 gestos | Ejercicio 03 |
| MediaPipe Pose Landmarker (lite) | 33 puntos del cuerpo | Ejercicio 03 |
| Pointer Events, DeviceMotion | Gestos táctiles y acelerómetro | Ejercicio 01 |
| WebXR + A-Frame | Realidad virtual y aumentada | Ejercicio 04 |

## Pruebas

```bash
node --test CRM/tests/voice.test.mjs
```

Prueban la gramática de comandos (navegación, altas, tareas con fecha, preferencias, clientes, preguntas) y el dictado (puntuación, espacios, mayúsculas, órdenes). La prueba de humo del CRM sigue en `CRM/tests/smoke.py` (Playwright).
