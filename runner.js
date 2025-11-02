(function () {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init() {
    const codeEl = document.getElementById('code');
    const pasteBtn = document.getElementById('paste');
    const runBtn = document.getElementById('run');
    const clearBtn = document.getElementById('clear');
    const sanitizeEl = document.getElementById('sanitize');
    const toggleEditorBtn = document.getElementById('toggleEditor');
    const editorWrap = document.getElementById('editorWrap');
    const desk = document.getElementById('desk');
    const toast = document.getElementById('toast');
    const chip = document.getElementById('statusChip');
    let iframe = document.getElementById('view');

    let lastCode = '';
    let timer;

    // ===== SERVICE FUNCTIONS =====
    function showToast(text) {
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toast.classList.remove('show'), 900);
    }

    function layout() {
      const topbarH = document.getElementById('topbar').offsetHeight;
      const editorH = editorWrap.offsetParent ? editorWrap.offsetHeight : 0;
      const avail = window.innerHeight - topbarH - editorH - 8;
      desk.style.height = Math.max(240, avail) + 'px';
    }
    window.addEventListener('resize', layout);

    function updateRunState() {
      const has = codeEl.value.trim().length > 0;
      runBtn.disabled = !has;
      if (!has) setChip('');
    }

    function setChip(state, msg = '') {
      chip.className = 'status-chip';
      chip.textContent = '';
      if (!state) return;
      if (state === 'live') {
        chip.classList.add('chip-live');
        const time = new Date().toLocaleTimeString();
        chip.textContent = `Работает (${time})`;
      } else if (state === 'dirty') {
        chip.classList.add('chip-dirty');
        chip.textContent = 'Изменено';
      } else if (state === 'error') {
        chip.classList.add('chip-error');
        chip.textContent = msg || 'Ошибка';
      }
    }

    function markRunning() {
      runBtn.classList.add('running');
      runBtn.textContent = 'Запуск...';
      runBtn.disabled = true;
    }

    function markLive() {
      runBtn.classList.remove('running', 'error');
      runBtn.classList.add('live');
      runBtn.textContent = 'Перезапустить';
      runBtn.disabled = false;
      setChip('live');
    }

    function markError(msg) {
      runBtn.classList.remove('running', 'live');
      runBtn.classList.add('error');
      runBtn.textContent = 'Ошибка';
      runBtn.disabled = false;
      setChip('error', msg);
    }

    function markDirty() {
      runBtn.classList.remove('live', 'error', 'running');
      runBtn.textContent = 'Запустить';
      runBtn.disabled = false;
      setChip('dirty');
    }

    // ===== EDITOR AND BUTTONS =====
    codeEl.addEventListener('input', () => {
      updateRunState();
      if (codeEl.value.trim() && codeEl.value !== lastCode) markDirty();
    });

    toggleEditorBtn.addEventListener('click', () => {
      const hide = !editorWrap.classList.contains('collapsed');
      editorWrap.classList.toggle('collapsed', hide);
      toggleEditorBtn.textContent = hide ? 'Показать редактор' : 'Скрыть редактор';
      layout();
    });

    pasteBtn.addEventListener('click', async () => {
      let inserted = null;
      try {
        if (window.AndroidBridge && AndroidBridge.getClipboardText) {
          inserted = AndroidBridge.getClipboardText();
        } else if (navigator.clipboard?.readText) {
          inserted = await navigator.clipboard.readText();
        }
      } catch {}
      if (inserted == null) {
        const manual = prompt('Вставьте текст вручную:');
        if (manual == null) return;
        inserted = manual;
      }
      codeEl.value = sanitizeEl.checked ? extractHtml(inserted) : inserted;
      updateRunState();
      showToast('Вставлено');
      markDirty();
    });

    clearBtn.addEventListener('click', () => {
      codeEl.value = '';
      updateRunState();
      resetIframe();
      showToast('Очищено');
      runBtn.classList.remove('live', 'running', 'error');
      runBtn.textContent = 'Запустить';
      setChip('');
      lastCode = '';
    });

    runBtn.addEventListener('click', () => {
      if (runBtn.disabled) return;
      const raw = codeEl.value || '';
      const user = sanitizeEl.checked ? extractHtml(raw) : raw;
      const doc = wrapDocument(user);
      lastCode = codeEl.value;
      executeCode(doc);
    });

    // ===== CORE =====
    function executeCode(doc) {
      markRunning();
      resetIframe();
      const fresh = document.createElement('iframe');
      fresh.id = 'view';
      fresh.setAttribute(
        'sandbox',
        'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin'
      );
      fresh.srcdoc = doc;
      desk.replaceChild(fresh, iframe);
      iframe = fresh;

      clearTimeout(timer);
      timer = setTimeout(() => markError('таймаут запуска'), 5000);

      iframe.onload = () => {
        clearTimeout(timer);
        markLive();
        showToast('Запущено');
      };
      iframe.onerror = () => {
        clearTimeout(timer);
        markError('Ошибка загрузки');
      };
    }

    function resetIframe() {
      const blank = document.createElement('iframe');
      blank.id = 'view';
      blank.setAttribute(
        'sandbox',
        'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin'
      );
      blank.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
      desk.replaceChild(blank, iframe);
      iframe = blank;
    }

    // ===== UTILITIES =====
    function extractHtml(text) {
      let t = text;
      const fence = /```(?:html|HTML|htm|HTM)?\s*([\s\S]*?)```/;
      const mFence = t.match(fence);
      if (mFence) t = mFence[1];
      const low = t.toLowerCase();
      const iDoctype = low.indexOf('<!doctype');
      const iHtml = low.indexOf('<html');
      let start = -1;
      if (iDoctype >= 0 && iHtml >= 0) start = Math.min(iDoctype, iHtml);
      else start = (iDoctype >= 0) ? iDoctype : iHtml;
      if (start >= 0) {
        t = t.slice(start);
        const endTag = t.toLowerCase().lastIndexOf('</html>');
        if (endTag >= 0) t = t.slice(0, endTag + 7);
        return t.trim();
      }
      return t.trim();
    }

    function wrapDocument(src) {
      const hasHtml = /<\s*html[\s>]/i.test(src);
      const hasHead = /<\s*head[\s>]/i.test(src);
      const viewport = `<meta name="viewport" content="width=device-width, initial-scale=1">`;
      if (hasHtml) {
        if (hasHead) {
          if (!/name=["']viewport["']/i.test(src)) {
            return src.replace(/<\s*head(\s[^>]*)?>/i, m => `${m}${viewport}`);
          }
          return src;
        }
        return src.replace(/<\s*html([^>]*)>/i, (m, attrs) => `<html${attrs}><head>${viewport}</head>`);
      }
      return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${viewport}
</head>
<body>
${src}
</body>
</html>`;
    }

    updateRunState();
    layout();
  }
})();
