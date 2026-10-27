// Presentation-only enhancements: keyboard access and focus for existing dialogs.
(() => {
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const openStack = [];
  const restoreFocus = new Map();
  let previousOverflow = '';
  const close = {
    'delivery-map-modal': () => closeDeliveryMapModal(),
    'admin-login-modal': () => closeAdminModals(),
    'admin-dashboard-modal': () => closeAdminModals(),
    'product-detail-modal': () => closeProductDetailModal(),
    'user-auth-modal': () => closeUserAuthModal(),
    'cart-drawer-modal': () => toggleCartDrawer(false),
    'mobile-drawer': () => document.getElementById('mobile-drawer').classList.add('hidden')
  };
  const focusable = dialog => [...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
    .filter(el => el.getClientRects().length && !el.closest('.hidden'));
  for (const dialog of dialogs) {
    const title = dialog.querySelector('h3') || dialog.querySelector('.font-display');
    if (title) { title.id ||= `${dialog.id}-title`; dialog.setAttribute('aria-labelledby', title.id); }
    dialog.addEventListener('click', event => { if (event.target === dialog) close[dialog.id]?.(); });
    new MutationObserver(() => {
      const shown = !dialog.classList.contains('hidden');
      const index = openStack.indexOf(dialog);
      if (shown && index < 0) {
        if (!openStack.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
        restoreFocus.set(dialog, document.activeElement);
        openStack.push(dialog);
        requestAnimationFrame(() => focusable(dialog)[0]?.focus({ preventScroll:true }));
      } else if (!shown && index >= 0) {
        openStack.splice(index, 1);
        if (!openStack.length) {
          document.body.style.overflow = previousOverflow;
          const target = restoreFocus.get(dialog);
          if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll:true });
        }
        restoreFocus.delete(dialog);
      }
    }).observe(dialog, { attributes:true, attributeFilter:['class'] });
  }
  document.addEventListener('keydown', event => {
    const dialog = openStack.at(-1);
    if (!dialog) return;
    if (event.key === 'Escape') { event.preventDefault(); close[dialog.id]?.(); }
    if (event.key === 'Tab') {
      const items = focusable(dialog), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  document.querySelectorAll('label').forEach(label => {
    const input = label.nextElementSibling;
    if (input?.id && /^(INPUT|TEXTAREA|SELECT)$/.test(input.tagName)) label.htmlFor = input.id;
  });
  for (const id of ['checkout-customer-name','checkout-customer-notes']) {
    const input = document.getElementById(id);
    input?.setAttribute('aria-label', input.placeholder);
  }
})();
