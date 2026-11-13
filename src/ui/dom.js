/** Small DOM helpers shared by the UI. No framework, no innerHTML for user data. */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  append(node, children);
  return node;
}

function applyAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class' || key === 'className') {
      node.className = value;
      continue;
    }
    if (key === 'text') {
      node.textContent = String(value);
      continue;
    }
    if (key === 'html') {
      // Only used with trusted, static icon markup.
      node.innerHTML = value;
      continue;
    }
    if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (dataValue !== null && dataValue !== undefined) node.dataset[dataKey] = String(dataValue);
      }
      continue;
    }
    if (key === 'style' && typeof value === 'object') {
      for (const [prop, propValue] of Object.entries(value)) {
        if (propValue !== null && propValue !== undefined) node.style.setProperty(prop, String(propValue));
      }
      continue;
    }
    if (key === 'value') {
      node.value = value;
      continue;
    }
    if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'hidden') {
      node[key] = Boolean(value);
      if (key === 'disabled' || key === 'hidden') {
        if (value) node.setAttribute(key, '');
        else node.removeAttribute(key);
      }
      continue;
    }
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }
    node.setAttribute(key, String(value));
  }
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      append(node, child);
      continue;
    }
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  append(node, children);
  return node;
}

export function byId(id) {
  return document.getElementById(id);
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setText(node, value) {
  if (node) node.textContent = value == null ? '' : String(value);
}

export function setHidden(node, hidden) {
  if (!node) return;
  node.hidden = Boolean(hidden);
}

export function toggleClass(node, className, force) {
  if (!node) return;
  node.classList.toggle(className, Boolean(force));
}

/** Focus the first sensible control inside a container. */
export function focusFirst(container) {
  if (!container) return;
  const preferred = container.querySelector(
    '[data-autofocus], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  );
  preferred?.focus({ preventScroll: true });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

/** Restore values for fields marked data-preserve after a dialog re-render. */
export function readPreserved(container) {
  const values = {};
  if (!container) return values;
  for (const field of container.querySelectorAll('[data-preserve]')) {
    values[field.dataset.preserve] = field.type === 'checkbox' ? field.checked : field.value;
  }
  return values;
}

export function applyPreserved(container, values) {
  if (!container || !values) return;
  for (const field of container.querySelectorAll('[data-preserve]')) {
    if (!(field.dataset.preserve in values)) continue;
    if (field.type === 'checkbox') field.checked = Boolean(values[field.dataset.preserve]);
    else field.value = values[field.dataset.preserve];
  }
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
