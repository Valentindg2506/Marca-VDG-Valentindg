// Proveedor real del asistente. Envía la pregunta y el contexto a tu servidor y lee la respuesta por partes.
//
// El servidor (PHP, Node…) es quien llama al modelo con la clave de la API guardada en su .env, consulta los datos
// del CRM que necesite y responde con una línea JSON por trozo, en el mismo formato que demo.js:
//   {"type":"text","text":"Este mes has facturado "}
//   {"type":"figure","label":"Facturado · 30 días","amount":85048.66}
//   {"type":"source","text":"Según 16 facturas"}
// Así el navegador nunca ve la clave, y el servidor decide qué datos salen hacia el modelo.
// Si el usuario tiene «Ocultar importes», la interfaz ya oculta las cifras al pintarlas; el servidor puede además
// no enviarlas al modelo si lo pide context.privacy.
export async function* remoteProvider(question, context, { endpoint = '/api/assistant', signal } = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
    signal
  });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line) yield JSON.parse(line);
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer);
}
