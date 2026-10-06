(function () {
  const get = (id) => document.getElementById(id);
  const compact = window.matchMedia('(max-width: 900px)');
  const phone = window.matchMedia('(max-width: 600px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const openers = new WeakMap();
  const animationByElement = new WeakMap();
  const dataSignatures = new WeakMap();
  const activeAnimations = new Set();
  let toastTimer;
  const tooltip = document.createElement('div');
  tooltip.id = 'hoverTooltip';
  tooltip.className = 'hover-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('popover', 'manual');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let tooltipOwner;
  let tooltipAnchor;
  let tooltipTimer;

  function animate(element, keyframes, options = {}) {
    if (compact.matches || reducedMotion.matches || !element?.animate) return;
    animationByElement.get(element)?.cancel();
    const animation = element.animate(keyframes, {
      duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards', ...options,
    });
    animationByElement.set(element, animation);
    activeAnimations.add(animation);
    animation.onfinish = animation.oncancel = () => activeAnimations.delete(animation);
  }

  function animateUpdate(element, kind = 'data') {
    if (!element) return;
    const signature = element.textContent;
    const previous = dataSignatures.get(element);
    dataSignatures.set(element, signature);
    if (signature === previous || compact.matches || reducedMotion.matches) return;
    if (kind === 'overview' && previous !== undefined) return;
    if (kind === 'cards' || kind === 'overview') {
      element.querySelectorAll('.metric-card, .category-number-row').forEach((card, index) => {
        animate(card, [{ opacity: .35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: Math.min(index * 24, 120) });
        const rail = card.querySelector('.category-rail i');
        if (rail) animate(rail, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 300 });
      });
    } else if (kind === 'chart') {
      const lines = element.querySelectorAll('.trend-line');
      lines.forEach(line => animate(line, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 300 }));
      element.querySelectorAll('.trend-point').forEach(point => animate(point, [{ opacity: .2 }, { opacity: 1 }], { delay: 80 }));
      if (!lines.length) animate(element, [{ opacity: .65 }, { opacity: 1 }]);
    } else animate(element, [{ opacity: .55 }, { opacity: 1 }], { duration: 180 });
  }

  function stopAnimations() {
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
  }

  function refreshIcons() {
    window.lucide?.createIcons({ attrs: { 'stroke-width': 1.75, 'aria-hidden': 'true' } });
    document.querySelectorAll('.interactive-card[data-tooltip]').forEach((card) => { card.tabIndex = 0; });
  }

  function icon(name) {
    return `<i data-lucide="${name}" aria-hidden="true"></i>`;
  }

  function syncModalState() {
    document.body.classList.toggle('modal-open', Boolean(document.querySelector('dialog[open]')));
    get('toolsPanelButton').setAttribute('aria-expanded', String(get('toolsPanel').open));
  }

  function open(dialog, focusTarget) {
    if (dialog.open) return;
    hideTooltip();
    openers.set(dialog, document.activeElement);
    dialog.returnValue = '';
    dialog.showModal();
    const transform = dialog.classList.contains('tools-panel') ? 'translateX(-18px)'
      : dialog.classList.contains('entry-dialog') ? 'translateX(18px)' : 'translateY(8px)';
    animate(dialog, [{ opacity: .5, transform }, { opacity: 1, transform: 'translate(0)' }]);
    syncModalState();
    focusTarget?.focus({ preventScroll: true });
  }

  function close(dialog) {
    animationByElement.get(dialog)?.cancel();
    if (dialog.open) dialog.close();
  }

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      animationByElement.get(dialog)?.cancel();
      syncModalState();
      const opener = openers.get(dialog);
      if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
    });
    dialog.addEventListener('cancel', (event) => {
      if (dialog.getAttribute('aria-busy') === 'true') event.preventDefault();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog || dialog.getAttribute('aria-busy') === 'true') return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(dialog);
    });
  });

  function setEntryMode(mode, focusTab = false) {
    ['chat', 'manual'].forEach((name) => {
      const active = name === mode;
      const tab = get(name === 'chat' ? 'entryChatTab' : 'entryManualTab');
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const view = get(name === 'chat' ? 'entryChatView' : 'entryManualView');
      const wasHidden = view.hidden;
      view.hidden = !active;
      if (active && wasHidden) animate(view, [{ opacity: .5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }]);
      if (active && focusTab) tab.focus();
    });
  }

  ['entryChatTab', 'entryManualTab'].forEach((id, index) => {
    get(id).addEventListener('click', () => setEntryMode(index ? 'manual' : 'chat'));
    get(id).addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      setEntryMode(event.key === 'Home' ? 'chat' : event.key === 'End' ? 'manual' : index ? 'chat' : 'manual', true);
    });
  });

  function mountResponsiveContent() {
    const active = document.activeElement;
    close(get('quickEntryModal'));
    close(get('detailDialog'));
    (compact.matches ? get('inlineEntryHost') : get('quickEntryModal')).append(get('entryContent'));
    (compact.matches ? get('detailDialog') : get('transactionsHost')).append(get('transactionsSection'));
    if (phone.matches) get('mobileSearchHost').append(get('globalSearch'));
    else get('topbarSearchHost').append(get('globalSearch'));
    if (active?.isConnected && active.getClientRects().length) active.focus({ preventScroll: true });
  }

  function openEntry() {
    window.FinancialBooks?.showDashboard();
    close(get('toolsPanel'));
    close(get('detailDialog'));
    const field = get('entryChatView').hidden ? get('descriptionInput') : get('chatInput');
    if (compact.matches) {
      get('entryContent').scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      field.focus({ preventScroll: true });
    } else open(get('quickEntryModal'), field);
  }

  function openDetails() {
    window.FinancialBooks?.showDashboard();
    if (compact.matches) open(get('detailDialog'), get('closeDetailButton'));
    else get('transactionsSection').scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }

  get('navTransactionsButton').addEventListener('click', (event) => {
    event.preventDefault();
    openDetails();
  });
  get('bankUploadButton').addEventListener('click', () => get('bankStatementInput').click());
  get('backupUploadButton').addEventListener('click', () => get('importExcelInput').click());
  document.addEventListener('mouseover', showTooltip);
  document.addEventListener('mouseout', (event) => {
    if (tooltipOwner?.contains(event.target) && !tooltipOwner.contains(event.relatedTarget)) scheduleTooltipHide();
  });
  document.addEventListener('focusin', showTooltip);
  document.addEventListener('focusout', scheduleTooltipHide);
  document.addEventListener('click', (event) => {
    if (tooltip.contains(event.target)) return;
    if (event.target.closest?.('.trend-point, .metric-card, .interactive-card')) showTooltip(event);
    else hideTooltip();
  });
  document.addEventListener('scroll', () => {
    if (tooltipOwner?.contains(document.activeElement)) positionTooltip();
    else hideTooltip();
  }, true);
  window.addEventListener('resize', hideTooltip);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !tooltip.hidden) {
      hideTooltip();
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('.trend-point') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      showTooltip(event);
    }
  });

  function showTooltip(event) {
    const owner = event.target.closest?.('[data-tooltip]');
    if (!owner?.dataset.tooltip) return;
    clearTimeout(tooltipTimer);
    const entering = tooltip.hidden || tooltipOwner !== owner;
    if (tooltipOwner !== owner) hideTooltip();
    tooltipOwner = owner;
    tooltip.textContent = owner.dataset.tooltip.replace(/ \| /g, '\n');
    const descriptions = new Set((owner.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    descriptions.add(tooltip.id);
    owner.setAttribute('aria-describedby', [...descriptions].join(' '));
    if (event.type === 'focusin') {
      const bounds = owner.getBoundingClientRect();
      if (bounds.top < 140 || bounds.bottom > window.innerHeight) owner.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    }
    tooltip.hidden = false;
    if (tooltip.showPopover && !tooltip.matches(':popover-open')) tooltip.showPopover();
    tooltipAnchor = event.target.closest?.('circle') || owner;
    positionTooltip();
    if (entering) animate(tooltip, [{ opacity: .4 }, { opacity: 1 }], { duration: 140 });
  }

  function positionTooltip() {
    if (tooltip.hidden || !tooltipAnchor?.isConnected) return;
    const rect = tooltipAnchor.getBoundingClientRect();
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = window.innerHeight;
    const size = tooltip.getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - size.width / 2, width - size.width - 12));
    const above = rect.top - size.height - 10;
    const top = above >= 12 ? above : Math.min(rect.bottom + 10, height - size.height - 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(12, Math.min(top, height - size.height - 12))}px`;
  }

  function hideTooltip() {
    clearTimeout(tooltipTimer);
    animationByElement.get(tooltip)?.cancel();
    if (tooltip.hidePopover && tooltip.matches(':popover-open')) tooltip.hidePopover();
    tooltip.hidden = true;
    if (tooltipOwner) {
      const descriptions = (tooltipOwner.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== tooltip.id);
      if (descriptions.length) tooltipOwner.setAttribute('aria-describedby', descriptions.join(' '));
      else tooltipOwner.removeAttribute('aria-describedby');
    }
    tooltipOwner = undefined;
    tooltipAnchor = undefined;
  }

  function scheduleTooltipHide() {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      if (!tooltipOwner?.contains(document.activeElement) && !tooltip.matches(':hover')) hideTooltip();
    }, 140);
  }
  tooltip.addEventListener('mouseenter', () => clearTimeout(tooltipTimer));
  tooltip.addEventListener('mouseleave', scheduleTooltipHide);
  new MutationObserver(() => {
    if (tooltipOwner && !tooltipOwner.isConnected) hideTooltip();
  }).observe(get('appShell'), { childList: true, subtree: true });
  compact.addEventListener('change', mountResponsiveContent);
  compact.addEventListener('change', stopAnimations);
  reducedMotion.addEventListener('change', stopAnimations);
  phone.addEventListener('change', mountResponsiveContent);

  function confirmAction({ title, message, accept = 'Lanjutkan', danger = false }) {
    const dialog = get('confirmDialog');
    if (dialog.open) return Promise.resolve(false);
    get('confirmTitle').textContent = title;
    get('confirmMessage').textContent = message;
    get('confirmAccept').textContent = accept;
    get('confirmAccept').classList.toggle('danger', danger);
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'accept'), { once: true });
      open(dialog);
    });
  }

  function toast(message, type = 'success') {
    const element = get('toast');
    clearTimeout(toastTimer);
    element.textContent = message;
    element.dataset.type = type;
    element.classList.remove('hidden');
    animate(element, [{ opacity: .4 }, { opacity: 1 }], { duration: 180 });
    toastTimer = setTimeout(() => element.classList.add('hidden'), 5000);
  }

  window.DashboardUI = { icon, refreshIcons, open, close, openEntry, openDetails, setEntryMode, confirm: confirmAction, toast, animateUpdate };
  mountResponsiveContent();
  refreshIcons();
})();
