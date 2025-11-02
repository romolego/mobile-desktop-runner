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

    const collapseEditorEl = document.getElementById('collapseEditor');
    const editorWrap = document.getElementById('editorWrap');

    const topbar = document.getElementById('topbar');
    const collapsePanelBtn = document.getElementById('collapsePanel');
    const expandFloatingBtn = document.getElementById('expandFloating');

    const desk = document.getElementById('desk');
    let iframe = document.getElementById('view');

    // --- Раскладка высоты
    function layout() {
      const topbarH = topbar.classList.contains('collapsed') ? 0 : topbar.offsetHeight;
      const editorH = editorWrap.offsetParent ? editorWrap.offsetHeight : 0;
      const pad = 10;
      const avail = window.innerHeight - topbarH - editorH - pad;
      desk.style.height = Math.max(240, avail) + 'px';
    }
    window.addEventListener('resize', layout);
    layout();

    // --- Сворачивание редактора
    collapseEditorEl.addEventListener('change', () => {
      editorWrap.classList.toggle('collapsed', collapseEditorEl.checked);
      layout();
    });

    // --- Сворачивание/разворачивание панели
    collapsePanelBtn.addEventListener('click', () => {
      topbar.classList.add('collapsed');
      expandFloatingBtn.style.display = 'inline-block';
      layout();
    });
    expandFloatingBtn.addEventListener('click', () => {
      topbar.classList.remove('collapsed');
      expandFloatingBtn.style.display = 'none';
      layout();
    });

    // --- Вставка из буфера: AndroidBridge → Clipboard API → prompt
    pasteBtn.addEventListener('click', async () => {
      try {
        if (window.AndroidBridge && AndroidBridge.getClipboardText) {
          const t = AndroidBridge.getClipboardText();
          codeEl.value = sanitizeEl.checked ? extractHtml(t) : t;
          return;
        }
        if (navigator.clipboard && navigator.clipboard.readText) {
          const txt = await navigator.clipboard.readText();
          codeEl.value = sanitizeEl.checked ? extractHtml(txt) : txt;
          return;
        }
      } catch (_) {}
      const manual = prompt('Вставьте текст вручную:');
      if (manual != null) codeEl.value = sanitizeEl.checked ? extractHtml(manual) : manual;
    });

    // --- Запуск кода
    runBtn.addEventListener('click', () => {
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

    // --- Очистить
    clearBtn.addEventListener('click', () => {
      codeEl.value = '';
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
    });

    // --- Утилиты
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

    // Обертка: добавляем viewport, если его нет, не вмешиваемся больше
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
