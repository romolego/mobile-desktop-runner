(function () {
  const codeEl = document.getElementById('code');
  const pasteBtn = document.getElementById('paste');
  const runBtn = document.getElementById('run');
  const clearBtn = document.getElementById('clear');
  const sanitizeEl = document.getElementById('sanitize');

  const collapseEditorEl = document.getElementById('collapseEditor');
  const editorWrap = document.getElementById('editorWrap');

  const desk = document.getElementById('desk');
  let iframe = document.getElementById('view');

  // ---- Раскладка: делаем результат на всю доступную высоту
  function layout() {
    const topbarH = document.querySelector('.topbar').offsetHeight;
    const editorH = editorWrap.offsetParent ? editorWrap.offsetHeight : 0; // если свернут, 0
    const pad = 10 /*stage bottom*/ + 10 /*stage left-right accounted in width*/;
    const avail = window.innerHeight - topbarH - editorH - pad;
    desk.style.height = Math.max(240, avail) + 'px';
  }
  window.addEventListener('resize', layout);
  layout();

  // ---- Сворачивание редактора
  collapseEditorEl.addEventListener('change', () => {
    editorWrap.classList.toggle('collapsed', collapseEditorEl.checked);
    layout();
  });

  // ---- Вставка из буфера
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
    } catch (e) {}
    const manual = prompt("Вставьте текст вручную:");
    if (manual != null) codeEl.value = sanitizeEl.checked ? extractHtml(manual) : manual;
  });

  // ---- Запуск кода
  runBtn.addEventListener('click', () => {
    const raw = codeEl.value || "";
    const user = sanitizeEl.checked ? extractHtml(raw) : raw;
    const doc = buildDocument(user);
    const fresh = document.createElement('iframe');
    fresh.id = 'view';
    // максимально открываем песочницу для полнофункциональной работы внутри
    fresh.setAttribute('sandbox',
      'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin'
    );
    fresh.srcdoc = doc;
    desk.replaceChild(fresh, iframe);
    iframe = fresh;
    layout();
  });

  // ---- Очистка
  clearBtn.addEventListener('click', () => {
    codeEl.value = "";
    const fresh = document.createElement('iframe');
    fresh.id = 'view';
    fresh.setAttribute('sandbox',
      'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin'
    );
    fresh.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';
    desk.replaceChild(fresh, iframe);
    iframe = fresh;
    layout();
  });

  // ---- Очистка «лишнего текста»
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

  // ---- Обёртка: минимальное вмешательство
  function buildDocument(src) {
    const hasHtml = /<\s*html[\s>]/i.test(src);
    const hasHead = /<\s*head[\s>]/i.test(src);

    // ПК: ширина = device-width; Телефон можно принудить 1920, но чтобы не ломать функционал, оставим device-width.
    const viewport = `<meta name="viewport" content="width=device-width, initial-scale=1">`;

    if (hasHtml) {
      if (hasHead) {
        // добавим viewport, если его нет
        if (!/name=["']viewport["']/i.test(src)) {
          return src.replace(/<\s*head(\s[^>]*)?>/i, m => `${m}${viewport}`);
        }
        return src;
      }
      // есть <html>, но нет <head>
      return src.replace(/<\s*html([^>]*)>/i, (m, attrs) =>
        `<html${attrs}><head>${viewport}</head>`
      );
    }

    // фрагмент без html — упакуем
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
})();
