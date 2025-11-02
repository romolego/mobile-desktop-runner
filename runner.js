(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const codeEl = document.getElementById('code');
    const pasteBtn = document.getElementById('paste');
    const runBtn = document.getElementById('run');
    const clearBtn = document.getElementById('clear');
    const sanitizeEl = document.getElementById('sanitize');
    const toggleEditorBtn = document.getElementById('toggleEditor');

    const editorWrap = document.getElementById('editorWrap');
    const topbar = document.getElementById('topbar');
    const desk = document.getElementById('desk');
    const toast = document.getElementById('toast');
    let iframe = document.getElementById('view');

    // ---- утилиты
    function showToast(text) {
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toast.classList.remove('show'), 900); // ~секунда
    }
    function updateRunState() {
      const has = (codeEl.value.trim().length > 0);
      runBtn.disabled = !has;
    }

    // ---- раскладка результата
    function layout() {
      const topbarH = topbar.offsetHeight;
      const editorH = editorWrap.offsetParent ? editorWrap.offsetHeight : 0;
      const pad = 8;
      const avail = window.innerHeight - topbarH - editorH - pad;
      desk.style.height = Math.max(240, avail) + 'px';
    }
    window.addEventListener('resize', layout);
    layout();

    // ---- реакция на ввод — включает/выключает «Запустить»
    codeEl.addEventListener('input', updateRunState);
    updateRunState();

    // ---- переключение редактора
    toggleEditorBtn.addEventListener('click', () => {
      const hide = !editorWrap.classList.contains('collapsed');
      editorWrap.classList.toggle('collapsed', hide);
      toggleEditorBtn.textContent = hide ? 'Показать редактор' : 'Скрыть редактор';
      layout();
    });

    // ---- вставка
    pasteBtn.addEventListener('click', async () => {
      let inserted = null;
      try {
        if (window.AndroidBridge && AndroidBridge.getClipboardText) {
          inserted = AndroidBridge.getClipboardText();
        } else if (navigator.clipboard && navigator.clipboard.readText) {
          inserted = await navigator.clipboard.readText();
        }
      } catch (_) { /* игнорируем */ }
      if (inserted == null) {
        const manual = prompt('Вставьте текст вручную:');
        if (manual == null) return;
        inserted = manual;
      }
      codeEl.value = sanitizeEl.checked ? extractHtml(inserted) : inserted;
      updateRunState();
      showToast('Вставлено');
    });

    // ---- запуск
    runBtn.addEventListener('click', () => {
      if (runBtn.disabled) return;
      const raw = codeEl.value || '';
      const user = sanitizeEl.checked ? extractHtml(raw) : raw;
      const doc = wrapDocument(user);
      const fresh = document.createElement('iframe');
      fresh.id = 'view';
      fresh.setAttribute(
        'sandbox',
        'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin'
      );
      fresh.srcdoc = doc;
      desk.replaceChild(fresh, iframe);
      iframe = fresh;
      layout();
    });

    // ---- очистить
    clearBtn.addEventListener('click', () => {
      codeEl.value = '';
      updateRunState();
      const fresh = document.createElement('iframe');
      fresh.id = 'view';
      fresh.setAttribute(
        'sandbox',
        'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin'
      );
      fresh.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';
      desk.replaceChild(fresh, iframe);
      iframe = fresh;
      layout();
      showToast('Очищено');
    });

    // ---- извлечение чистого HTML
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

    // ---- обёртка документа
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
  }
})();
