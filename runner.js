(function () {
  const codeEl = document.getElementById('code');
  const pasteBtn = document.getElementById('paste');
  const runBtn = document.getElementById('run');
  const clearBtn = document.getElementById('clear');
  const sanitizeEl = document.getElementById('sanitize');
  const lockScrollEl = document.getElementById('lockScroll');
  const stageScale = document.getElementById('stageScale');
  const zMinus = document.getElementById('zMinus');
  const zPlus  = document.getElementById('zPlus');
  const zReset = document.getElementById('zReset');
  const zVal   = document.getElementById('zVal');
  let iframe = document.getElementById('view');

  let zoomMode = 'auto';
  function applyScale() {
    if (zoomMode === 'auto') {
      const pad = 24;
      const availW = document.querySelector('.stage-outer').clientWidth - pad;
      const baseW = 1024;
      const scale = Math.min(1, Math.max(0.25, availW / baseW));
      stageScale.style.transform = `scale(${scale.toFixed(3)})`;
      zVal.textContent = 'auto';
    } else {
      const s = Math.max(0.25, Math.min(2, zoomMode));
      stageScale.style.transform = `scale(${s})`;
      zVal.textContent = Math.round(s * 100) + '%';
    }
  }
  window.addEventListener('resize', () => { if (zoomMode === 'auto') applyScale(); });
  applyScale();
  zMinus.addEventListener('click', () => { zoomMode = typeof zoomMode === 'number' ? zoomMode - 0.1 : 0.9; applyScale(); });
  zPlus .addEventListener('click', () => { zoomMode = typeof zoomMode === 'number' ? zoomMode + 0.1 : 1.1; applyScale(); });
  zReset.addEventListener('click', () => { zoomMode = 1; applyScale(); });

  pasteBtn.addEventListener('click', async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const cleaned = sanitizeEl.checked ? extractHtml(txt) : txt;
      codeEl.value = cleaned;
    } catch (e) {
      alert('Доступ к буферу заблокирован браузером. Вставьте вручную (долгое нажатие → Вставить).');
    }
  });

  runBtn.addEventListener('click', () => {
    const raw = codeEl.value || "";
    const user = sanitizeEl.checked ? extractHtml(raw) : raw;
    const doc = buildDocumentWithWrapper(user);
    const fresh = document.createElement('iframe');
    fresh.id = 'view';
    fresh.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-pointer-lock');
    fresh.srcdoc = doc;
    document.querySelector('.desk').replaceChild(fresh, iframe);
    iframe = fresh;
    setTimeout(() => postScrollLock(lockScrollEl.checked), 30);
  });

  clearBtn.addEventListener('click', () => {
    codeEl.value = "";
    const blank = buildDocumentWithWrapper("");
    const fresh = document.createElement('iframe');
    fresh.id = 'view';
    fresh.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-pointer-lock');
    fresh.srcdoc = blank;
    document.querySelector('.desk').replaceChild(fresh, iframe);
    iframe = fresh;
  });

  lockScrollEl.addEventListener('change', () => postScrollLock(lockScrollEl.checked));
  function postScrollLock(isLocked){
    const fr = document.getElementById('view');
    if (!fr || !fr.contentWindow) return;
    fr.contentWindow.postMessage({type:'__mdr_scroll_lock', value: !!isLocked}, '*');
  }

  function extractHtml(text) {
    let t = text;
    const fence = /```(?:html|HTML|htm|HTM)?\s*([\s\S]*?)```/;
    const mFence = t.match(fence);
    if (mFence) t = mFence[1];
    const low = t.toLowerCase();
    const idxDoctype = low.indexOf('<!doctype');
    const idxHtml = low.indexOf('<html');
    let start = -1;
    if (idxDoctype >= 0 && idxHtml >= 0) start = Math.min(idxDoctype, idxHtml);
    else start = (idxDoctype >= 0) ? idxDoctype : idxHtml;
    if (start >= 0) {
      t = t.slice(start);
      const endTag = t.toLowerCase().lastIndexOf('</html>');
      if (endTag >= 0) t = t.slice(0, endTag + 7);
      return t.trim();
    }
    return t.trim();
  }

  function buildDocumentWithWrapper(src) {
    const hasHtml = /<\s*html[\s>]/i.test(src);
    const hasHead = /<\s*head[\s>]/i.test(src);
    const viewport = `<meta name="viewport" content="width=1024, initial-scale=1">`;

    const wrapperCSS = `
<style>
#_inframe_popup_root { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.35); z-index: 2147483000; }
._inframe_popup_box { width: min(900px, 92vw); height: min(620px, 84vh); background: #fff; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.35); display: grid; grid-template-rows: auto 1fr; overflow: hidden; border: 1px solid #cfd6df;}
._inframe_popup_bar { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; padding: 8px 10px; background: #f5f7fb; border-bottom: 1px solid #e3e8ef; font: 13px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, Arial;}
._inframe_popup_bar b { font-weight: 600; color: #111; }
._inframe_popup_close { border: 1px solid #c9ced6; background: #fff; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
._inframe_popup_frame { width: 100%; height: 100%; border: 0; background: #fff; }
</style>`;

    const wrapperJS = `
<script>
(function(){
  let root = null;
  function ensureRoot(){
    if (!root) {
      root = document.createElement('div');
      root.id = '_inframe_popup_root';
      root.innerHTML = '<div class="_inframe_popup_box"><div class="_inframe_popup_bar"><b id="_inframe_popup_title">Окно</b><button class="_inframe_popup_close" id="_inframe_popup_close">Закрыть</button></div><iframe class="_inframe_popup_frame" id="_inframe_popup_frame"></iframe></div>';
      document.body.appendChild(root);
      document.getElementById('_inframe_popup_close').addEventListener('click', () => {
        root.style.display = 'none';
        const f = document.getElementById('_inframe_popup_frame');
        f.srcdoc = ''; f.removeAttribute('src');
      });
    }
    return root;
  }

  const _origOpen = window.open;
  window.open = function(url, name, specs){
    try {
      const holder = ensureRoot();
      const titleEl = document.getElementById('_inframe_popup_title');
      const frame = document.getElementById('_inframe_popup_frame');
      holder.style.display = 'flex';
      titleEl.textContent = (name || 'Окно');

      if (typeof url === 'string' && /<\\s*(!doctype|html|head|body)/i.test(url.trim())) {
        frame.removeAttribute('src');
        frame.srcdoc = url;
      } else if (typeof url === 'string') {
        frame.removeAttribute('srcdoc');
        frame.src = url;
      } else {
        frame.removeAttribute('src');
        frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><title>Пустая страница</title></head><body></body></html>';
      }
      return { document:null, close:()=>{holder.style.display='none';}, focus:()=>{}, blur:()=>{} };
    } catch(e){
      try { return _origOpen ? _origOpen(url, name, specs) : null; } catch(_){}
      return null;
    }
  };

  document.addEventListener('click', function(ev){
    const a = ev.target.closest && ev.target.closest('a[target="_blank"]');
    if (a && a.href) { ev.preventDefault(); window.open(a.href, a.getAttribute('title') || a.textContent || 'Ссылка'); }
  }, true);

  let styleNode = null;
  function applyScrollLock(on){
    if (on) {
      if (!styleNode) {
        styleNode = document.createElement('style');
        styleNode.id = '_mdr_scroll_lock';
        styleNode.textContent = 'html, body { overflow: hidden !important; overscroll-behavior: none !important; touch-action: none !important; }';
        document.head.appendChild(styleNode);
      }
      const prevent = e => { e.preventDefault(); e.stopPropagation(); };
      window._mdr_blockers = [['wheel',prevent,{passive:false,capture:true}],['touchmove',prevent,{passive:false,capture:true}],['scroll',prevent,{passive:false,capture:true}]];
      _mdr_blockers.forEach(([t,h,o]) => addEventListener(t,h,o));
    } else {
      if (styleNode && styleNode.parentNode) styleNode.parentNode.removeChild(styleNode), styleNode=null;
      if (window._mdr_blockers) { window._mdr_blockers.forEach(([t,h,o]) => removeEventListener(t,h,o)); window._mdr_blockers=null; }
    }
  }
  window.addEventListener('message', function(ev){
    const msg = ev && ev.data;
    if (msg && msg.type === '__mdr_scroll_lock') applyScrollLock(!!msg.value);
  });
})();
<\/script>`;

    if (hasHtml) {
      let out = src;
      if (hasHead) out = out.replace(/<\s*head(\s[^>]*)?>/i, m => `${m}${viewport}${wrapperCSS}${wrapperJS}`);
      else out = out.replace(/<\s*html([^>]*)>/i, (m, attrs) => `<html${attrs}><head>${viewport}${wrapperCSS}${wrapperJS}</head>`);
      return out;
    }

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${viewport}
${wrapperCSS}
${wrapperJS}
</head>
<body>
${src}
</body>
</html>`;
  }
})();
