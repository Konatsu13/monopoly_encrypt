/** Non-blocking toast notifications. */

import { el } from './dom.js';
import { icon } from './icons.js';

let root = null;
const MAX_TOASTS = 4;

export function initToast(rootElement) {
  root = rootElement;
}

const ICONS = {
  info: 'info',
  success: 'check',
  error: 'warning',
  warn: 'warning'
};

export function showToast(message, type = 'info', timeout = 4200) {
  if (!root) return null;
  while (root.children.length >= MAX_TOASTS) root.firstElementChild?.remove();

  const toast = el('div', { class: `toast is-${type}`, role: type === 'error' ? 'alert' : 'status' });
  toast.appendChild(el('span', { class: 'toast-icon' }, icon(ICONS[type] ?? 'info', { size: 15 })));
  toast.appendChild(el('span', { class: 'toast-message', text: message }));
  const close = el(
    'button',
    { class: 'toast-close', type: 'button', 'aria-label': 'Tutup pemberitahuan' },
    icon('close', { size: 13 })
  );
  toast.appendChild(close);
  root.appendChild(toast);

  let timer = null;
  const remove = () => {
    if (timer) clearTimeout(timer);
    toast.remove();
  };
  close.addEventListener('click', remove);
  if (timeout > 0) timer = setTimeout(remove, timeout);
  return toast;
}

export function clearToasts() {
  root?.replaceChildren();
}
