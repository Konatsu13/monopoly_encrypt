/** Single-modal manager with focus handling and a small keyed lifecycle. */

import { el, mount, focusFirst, readPreserved, applyPreserved } from './dom.js';
import { icon } from './icons.js';

let root = null;
let active = null;
let lastFocused = null;

export function initModal(rootElement) {
  root = rootElement;
  document.addEventListener('keydown', onKeyDown, true);
}

function onKeyDown(event) {
  if (!active) return;
  if (event.key === 'Escape') {
    if (active.dismissible) {
      event.preventDefault();
      closeModal();
    }
    return;
  }
  if (event.key !== 'Tab') return;

  const focusables = [...active.overlay.querySelectorAll(
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )].filter((node) => node.offsetParent !== null || node === document.activeElement);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function buildShell({ key, kicker, title, subtitle, dismissible, wide, small, onClose }) {
  const overlay = el('div', { class: 'modal-overlay', role: 'presentation' });
  const modal = el('div', {
    class: `modal${wide ? ' modal-wide' : ''}${small ? ' modal-small' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'modal-title',
    'aria-describedby': subtitle ? 'modal-subtitle' : null
  });

  const head = el('div', { class: 'modal-head' });
  const headText = el('div', { class: 'modal-head-text' });
  if (kicker) headText.appendChild(el('p', { class: 'modal-kicker', text: kicker }));
  headText.appendChild(el('h2', { class: 'modal-title', id: 'modal-title', text: title }));
  if (subtitle) headText.appendChild(el('p', { class: 'modal-subtitle', id: 'modal-subtitle', text: subtitle }));
  head.appendChild(headText);

  if (dismissible) {
    const close = el(
      'button',
      {
        class: 'modal-close',
        type: 'button',
        'aria-label': 'Tutup panel',
        onClick: () => closeModal()
      },
      icon('close', { size: 16 })
    );
    head.appendChild(close);
  }

  const body = el('div', { class: 'modal-body' });
  modal.appendChild(head);
  modal.appendChild(body);
  overlay.appendChild(modal);

  if (dismissible) {
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) closeModal();
    });
  }

  return { overlay, modal, body, key, onClose, dismissible };
}

export function openModal(options) {
  if (!root) throw new Error('Modal root belum diinisialisasi.');
  if (active) {
    // Preserve the current dialog's transient values when replacing it.
    const preserved = readPreserved(active.body);
    closeModal({ silent: true });
    active = buildShell(options);
    active.preserved = preserved;
  } else {
    lastFocused = document.activeElement;
    active = buildShell(options);
    active.preserved = {};
  }

  mount(active.body, options.content ?? null);
  mount(root, active.overlay);
  document.body.classList.add('modal-open');

  if (options.footer) {
    const foot = el('div', { class: 'modal-foot' });
    mount(foot, options.footer);
    active.modal.appendChild(foot);
  }

  applyPreserved(active.body, active.preserved);
  requestAnimationFrame(() => focusFirst(options.initialFocus ? options.initialFocus(active.body) : active.body));
  return active;
}

/** Replace the body of the open dialog while keeping its frame and focus. */
export function updateModal({ title, subtitle, content, footer }) {
  if (!active) return null;
  if (title !== undefined) active.body.parentElement.querySelector('.modal-title').textContent = title;
  if (subtitle !== undefined) {
    const sub = active.body.parentElement.querySelector('.modal-subtitle');
    if (sub) sub.textContent = subtitle;
    else if (subtitle) {
      active.body.parentElement
        .querySelector('.modal-head-text')
        .appendChild(el('p', { class: 'modal-subtitle', id: 'modal-subtitle', text: subtitle }));
    }
  }

  const preserved = readPreserved(active.body);
  mount(active.body, content ?? null);
  const oldFoot = active.modal.querySelector('.modal-foot');
  if (oldFoot) oldFoot.remove();
  if (footer) {
    const foot = el('div', { class: 'modal-foot' });
    mount(foot, footer);
    active.modal.appendChild(foot);
  }
  applyPreserved(active.body, preserved);
  requestAnimationFrame(() => focusFirst(active.body));
  return active;
}

export function closeModal({ silent = false, force = false } = {}) {
  if (!active) return;
  if (!force && !active.dismissible && !silent) return;
  const { overlay, onClose } = active;
  const previousFocus = lastFocused;
  active = null;
  overlay.remove();
  if (root) root.replaceChildren();
  document.body.classList.remove('modal-open');
  if (!silent) onClose?.();
  if (!silent && previousFocus && typeof previousFocus.focus === 'function') {
    try {
      previousFocus.focus({ preventScroll: true });
    } catch {
      // The element may have been removed.
    }
  }
  lastFocused = silent ? previousFocus : null;
}

export function getActiveModal() {
  return active ? { key: active.key, dismissible: active.dismissible } : null;
}

export function isModalOpen() {
  return Boolean(active);
}
