// data-wa="kljuc" pravi WhatsApp link sa unapred ispisanom porukom; data-wa-color="Naziv" dodaje izabranu boju.
import { CONFIG } from './config.js';
import { t } from './i18n.js';

export function initWhatsApp() {
  document.querySelectorAll('[data-wa]').forEach(a => {
    let text = `${t('wa.hello')} ${t(a.dataset.wa)}`;
    if (a.dataset.waColor) text += `\n${t('wa.color')}: ${a.dataset.waColor}`;
    a.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  });
  document.querySelectorAll('[data-viber]').forEach(a => { a.href = `viber://chat?number=%2B${CONFIG.viber}`; });
  document.querySelectorAll('[data-mail]').forEach(a => {
    a.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('JSK Enterijer')}`;
  });
}
