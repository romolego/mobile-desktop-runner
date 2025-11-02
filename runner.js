(function () {
  // гарантированная инициализация
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
    const expandPanelBtn = document.getElementById('expandPanel');

    const desk = document.getElementById('desk');
    let iframe = document.getElementById('view');

    // ---- раскладка: высота результата = всё доступное
    function layout() {
      const topbarH = topbar.classList.contains('collapsed') ? 14 : document.querySelector('.topbar').offsetHeight;
      const editorH = editorWrap.offsetParent ? editorWrap.offsetHeight : 0;
      const pad = 10; // нижний паддинг
      const avail = window.innerHeight - topbarH - editorH - pad;
      desk.style.height = Math.max(240, avail) + 'px';
    }
    window.addEventListener('resize', layout);
    layout();

    // ---- сворачивание редактора
    collapseEditorEl.addEventListener('change', () => {
      editorWrap.classList.toggle('collapsed', collapseEditorEl.checked);
      layout();
    });

    // ---- сворачивание панели
    collapsePanelBtn.addEventListener('click', () => {
      topbar.classList.add('collapsed');
      layout();
    });
    expandPanelBtn.addEventListener('click', () => {
      topbar.classList.remove('collapsed');
      layout();
    });

    // ---- вставка (Clipboard API / AndroidBridge / prompt)
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

    // ---- запуск кода
    runBtn.addEventListener('click', () => {
      const raw = codeEl.value || '';
      const user = sanitizeEl.checked ? extractHtml(raw) : raw;
      const doc = wrapDocument(user);
      const fresh = document.createElement('iframe');
      fresh.id = 'view';
      fresh.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin');
      fresh.srcdoc = doc;
      desk.replaceChild(fresh, iframe);
      iframe = fresh;
      layout();
    });

    // ---- очистка
    clearBtn.addEventListener('click', () => {
      codeEl.value = '';
      const fresh = document.createElement('iframe');
      fresh.id = 'view';
      fresh.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin');
      fresh.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';
      desk.replaceChild(fresh, iframe);
      iframe = fresh;
      layout();
    });

    // ---- утилиты
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

    // минимальная обёртка без вмешательства в содержимое
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
