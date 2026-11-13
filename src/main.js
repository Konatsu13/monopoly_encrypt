/**
 * Browser bootstrap.
 *
 * Loads and validates every JSON data file, builds the cipher, initializes the
 * UI roots, and only then leaves the loading screen. Any failure is shown on
 * the fatal screen instead of leaving the user on a spinner forever.
 */

import { loadGameData } from './data-loader.js';
import { summarizeValidation } from './data-validation.js';
import { buildCipher } from './crypto/encryption.js';
import { App } from './app.js';
import { initModal } from './ui/modal.js';
import { initToast } from './ui/toast.js';

const LOADING_SCREEN = 'screen-loading';
const FATAL_SCREEN = 'screen-fatal';

function setLoadingDetail(message) {
  const node = document.getElementById('loading-detail');
  if (node) node.textContent = message;
}

function showFatal(error) {
  const loading = document.getElementById(LOADING_SCREEN);
  const fatal = document.getElementById(FATAL_SCREEN);
  const detail = document.getElementById('fatal-detail');
  if (loading) loading.hidden = true;
  if (fatal) fatal.hidden = false;
  if (detail) {
    detail.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  }
}

async function boot() {
  try {
    setLoadingDetail('Memuat berkas papan, properti, kartu, dan cerita…');
    const { data, validation } = await loadGameData();

    if (!validation.ok) {
      throw new Error(summarizeValidation(validation));
    }
    if (validation.warnings.length > 0) {
      console.warn('Peringatan data permainan:', validation.warnings);
    }

    setLoadingDetail('Memvalidasi komposisi dan invers fungsi pada 26 huruf…');
    const cipher = buildCipher(data.encryptionConfig);

    initModal(document.getElementById('modal-root'));
    initToast(document.getElementById('toast-root'));

    const app = new App({ data, cipher, story: data.story });
    app.bindControls();
    window.__lostCipherApp = app;

    // Expose a small read-only diagnostic for manual testing.
    window.__lostCipherDiagnostics = {
      dataWarnings: validation.warnings,
      keyId: data.encryptionConfig.keyId,
      keyApproved: data.encryptionConfig.approved,
      roundTrip: (() => {
        let ok = true;
        for (let index = 0; index < 26; index += 1) {
          if (cipher.decryptIndex(cipher.encryptIndex(index)) !== index) ok = false;
        }
        return ok;
      })()
    };

    setLoadingDetail('Siap.');
    app.showMenu();

    window.addEventListener('beforeunload', () => app.saveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') app.saveNow();
    });
  } catch (error) {
    console.error(error);
    showFatal(error);
  }
}

boot();
