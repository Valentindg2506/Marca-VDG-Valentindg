// Actualiza el DOM existente para que coincida con un HTML nuevo tocando solo lo que cambia.
// Así se puede describir la pantalla entera como texto sin perder foco, scroll, selección ni animaciones.
// Los hijos con data-key se emparejan por clave (listas que se reordenan); el resto, por posición.
// Sin dependencias.

const keyOf = node => (node.nodeType === Node.ELEMENT_NODE ? node.getAttribute('data-key') : null);

function sameKind(a, b) {
  return a.nodeType === b.nodeType && (a.nodeType !== Node.ELEMENT_NODE || (a.tagName === b.tagName && keyOf(a) === keyOf(b)));
}

function syncAttributes(current, next) {
  for (const { name } of [...current.attributes]) {
    if (!next.hasAttribute(name)) current.removeAttribute(name);
  }
  for (const { name, value } of next.attributes) {
    if (current.getAttribute(name) !== value) current.setAttribute(name, value);
  }
}

// value, checked y selected son propiedades vivas: el atributo solo marca el valor inicial.
function syncFormState(current, next) {
  const focused = current === document.activeElement;
  if (current instanceof HTMLInputElement) {
    if (current.type === 'checkbox' || current.type === 'radio') current.checked = next.hasAttribute('checked');
    else if (!focused && current.value !== (next.getAttribute('value') ?? '')) current.value = next.getAttribute('value') ?? '';
  } else if (current instanceof HTMLTextAreaElement) {
    if (!focused && current.value !== next.textContent) current.value = next.textContent;
  } else if (current instanceof HTMLSelectElement) {
    const selected = [...next.options].find(o => o.hasAttribute('selected')) ?? next.options[0];
    if (selected && current.value !== selected.value) current.value = selected.value;
  }
}

function patch(current, next) {
  if (current.nodeType !== Node.ELEMENT_NODE) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  syncAttributes(current, next);
  if (!(current instanceof HTMLTextAreaElement)) patchChildren(current, next);
  syncFormState(current, next);
}

function patchChildren(parent, next) {
  const incoming = [...next.childNodes];
  const keyed = new Map([...parent.childNodes].filter(keyOf).map(node => [keyOf(node), node]));
  const stillNeeded = new Set(incoming.map(keyOf).filter(Boolean));
  incoming.forEach((node, index) => {
    let current = parent.childNodes[index];
    const key = keyOf(node);
    if (key && keyed.has(key) && keyed.get(key) !== current) {
      current = keyed.get(key);
      parent.insertBefore(current, parent.childNodes[index] ?? null);
    }
    if (!current) parent.appendChild(node);
    else if (sameKind(current, node)) patch(current, node);
    // Si el nodo actual aparece más adelante, se inserta el nuevo delante: sacarlo del DOM le haría perder el foco.
    else if (stillNeeded.has(keyOf(current))) parent.insertBefore(node, current);
    else parent.replaceChild(node, current);
  });
  while (parent.childNodes.length > incoming.length) parent.lastChild.remove();
}

export function morph(target, markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  patchChildren(target, template.content);
}
