/* Envoltorio de la Web Speech API: reconocimiento (SpeechRecognition) y síntesis (speechSynthesis).
   No depende del resto de la app: se puede llevar a otro proyecto tal cual.

   listen({ lang, continuous, onInterim, onFinal, onState, onError }) → { stop(), abort() }
     - onInterim(texto)   lo que se va entendiendo mientras se habla (cambia)
     - onFinal(texto)     frase cerrada por el reconocedor (ya no cambia)
     - onState(estado)    'listening' | 'idle'
     - onError(código)    'not-allowed', 'no-speech', 'network', 'audio-capture'…
   En modo continuo el reconocedor de Chrome se corta solo tras unos segundos de silencio:
   se vuelve a arrancar hasta que se llama a stop(). */

const Recognition = () => globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition ?? null;

export const canListen = () => Boolean(Recognition());
export const canSpeak = () => 'speechSynthesis' in globalThis && typeof globalThis.SpeechSynthesisUtterance === 'function';

const LANGS = { es: 'es-ES', en: 'en-GB' };
export const speechLang = code => LANGS[code] ?? code;

export function listen({ lang = 'es', continuous = false, onInterim = () => {}, onFinal = () => {}, onState = () => {}, onError = () => {} } = {}) {
  const Engine = Recognition();
  if (!Engine) {
    onError('unsupported');
    return { stop() {}, abort() {} };
  }
  let wanted = true;
  let recognition = null;
  let restarts = 0;

  const start = () => {
    recognition = new Engine();
    recognition.lang = speechLang(lang);
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => onState('listening');
    recognition.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) { restarts = 0; onFinal(text.trim()); } else interim += text;
      }
      onInterim(interim.trim());
    };
    recognition.onerror = event => {
      // «no-speech» y «aborted» en modo continuo no son fallos: se vuelve a escuchar.
      if (continuous && wanted && ['no-speech', 'aborted'].includes(event.error)) return;
      wanted = false;
      onError(event.error);
    };
    recognition.onend = () => {
      if (wanted && continuous && restarts < 20) {
        restarts += 1;
        try { start(); return; } catch { /* sigue abajo */ }
      }
      wanted = false;
      onInterim('');
      onState('idle');
    };
    recognition.start();
  };

  try { start(); } catch (error) { wanted = false; onError('start-failed'); onState('idle'); }

  return {
    stop() { wanted = false; recognition?.stop(); },
    abort() { wanted = false; recognition?.abort(); }
  };
}

// Respuesta hablada. Corta la anterior para que no se acumulen frases.
export function speak(text, lang = 'es') {
  if (!canSpeak() || !text) return;
  const synth = globalThis.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang(lang);
  const voice = synth.getVoices().find(v => v.lang === utterance.lang) ?? synth.getVoices().find(v => v.lang.startsWith(lang));
  if (voice) utterance.voice = voice;
  utterance.rate = 1.05;
  synth.speak(utterance);
}

export const stopSpeaking = () => { if (canSpeak()) globalThis.speechSynthesis.cancel(); };
