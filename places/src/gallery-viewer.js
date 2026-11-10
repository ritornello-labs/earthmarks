/* Scoped image viewer for field-authored Christianity galleries. No dependencies. */
(function () {
  'use strict';
  if (window.ankiGalleryViewer) window.ankiGalleryViewer.destroy();
  var selector = '[data-christianity-gallery] [data-hero]';
  var modal, hero, stage, picture, readout, previousFocus, observer;
  var zoom = 1, x = 0, y = 0, fitWidth = 0, fitHeight = 0;
  var pointers = new Map(), gesture, oldOverflow, oldBodyOverflow;
  var style = document.createElement('style');
  style.textContent = `
    ${selector} { cursor:zoom-in; }
    .agv { position:fixed!important; inset:0!important; z-index:2147483647!important;
      display:flex!important; flex-direction:column!important; margin:0!important;
      background:#11151b!important; color:#f5f5f7!important; text-align:left!important;
      font:15px/1.4 system-ui,-apple-system,sans-serif!important; overscroll-behavior:contain; }
    .agv * { box-sizing:border-box; }
    .agv-header { display:flex; align-items:center; gap:16px; padding:12px 16px;
      padding-top:max(12px,env(safe-area-inset-top)); flex:none; }
    .agv-caption { flex:1; margin:0; font-size:14px; max-height:4.2em; overflow:auto; color:#e2e5ea; }
    .agv a { display:inline-flex!important; align-items:center; justify-content:center;
      min-width:44px; min-height:44px; padding:8px 13px; margin:0; border:1px solid #ffffff30;
      border-radius:12px; background:#ffffff0e; color:#fff!important; text-decoration:none!important;
      font:600 15px/1 system-ui,-apple-system,sans-serif; -webkit-tap-highlight-color:transparent; }
    .agv a:hover,.agv a:focus-visible { background:#ffffff25; outline:2px solid #b3d9ff; outline-offset:2px; }
    .agv a[aria-disabled=true] { opacity:.4; }
    .agv-stage { position:relative; flex:1; min-height:0; overflow:hidden; touch-action:none;
      user-select:none; -webkit-user-select:none; cursor:grab; }
    .agv-stage:active { cursor:grabbing; }
    .agv .agv-image { position:absolute!important; left:50%!important; top:50%!important;
      display:block!important; max-width:none!important; max-height:none!important;
      min-width:0!important; min-height:0!important; margin:0!important; padding:0!important;
      border:0!important; border-radius:0!important; object-fit:contain!important;
      transform-origin:center!important; pointer-events:none; -webkit-user-drag:none; }
    .agv-footer { flex:none; text-align:center; padding:10px 12px;
      padding-bottom:max(12px,env(safe-area-inset-bottom)); }
    .agv-controls { display:flex; justify-content:center; align-items:center; gap:8px; }
    .agv-zoom { min-width:48px; font-variant-numeric:tabular-nums; color:#e2e5ea; }
    .agv-hint { margin:8px 0 0; color:#adb6c3; font-size:12px; }
    @media(max-width:420px) { .agv-header { padding-left:12px; padding-right:12px; gap:8px; } }
  `;
  document.head.appendChild(style);
  function consume(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function control(action, label, title) {
    return '<a href="#gallery-viewer" role="button" data-agv="' + action + '" aria-label="' + title + '" title="' + title + '">' + label + '</a>';
  }
  function paint() {
    if (!modal || !fitWidth) return;
    var r = stage.getBoundingClientRect();
    var maxX = Math.max(0, (fitWidth * zoom - r.width) / 2);
    var maxY = Math.max(0, (fitHeight * zoom - r.height) / 2);
    x = Math.max(-maxX, Math.min(maxX, x)); y = Math.max(-maxY, Math.min(maxY, y));
    picture.style.setProperty('width', fitWidth + 'px', 'important');
    picture.style.setProperty('height', fitHeight + 'px', 'important');
    picture.style.setProperty('transform', 'translate(-50%,-50%) translate(' + x + 'px,' + y + 'px) scale(' + zoom + ')', 'important');
    readout.textContent = Math.round(zoom * 100) + '%';
    modal.dataset.zoom = String(zoom); modal.dataset.panX = String(x); modal.dataset.panY = String(y);
    modal.querySelector('[data-agv=out]').setAttribute('aria-disabled', zoom <= 1 ? 'true' : 'false');
    modal.querySelector('[data-agv=in]').setAttribute('aria-disabled', zoom >= 8 ? 'true' : 'false');
  }
  function fit() {
    if (!modal || !picture.naturalWidth) return;
    var r = stage.getBoundingClientRect();
    var ratio = Math.min((r.width - 24) / picture.naturalWidth, (r.height - 24) / picture.naturalHeight);
    fitWidth = picture.naturalWidth * ratio; fitHeight = picture.naturalHeight * ratio;
    zoom = 1; x = y = 0; pointers.clear(); gesture = null; paint();
  }
  function zoomAt(value, cx, cy) {
    if (!modal) return;
    var r = stage.getBoundingClientRect(), next = Math.max(1, Math.min(8, value)), k = next / zoom;
    cx = cx === undefined ? r.width / 2 : cx; cy = cy === undefined ? r.height / 2 : cy;
    x = (x - (cx - r.width / 2)) * k + cx - r.width / 2;
    y = (y - (cy - r.height / 2)) * k + cy - r.height / 2;
    zoom = next; paint();
  }
  function close() {
    if (!modal) return;
    observer.disconnect(); picture.onload = null;
    modal.remove(); modal = null; pointers.clear(); gesture = null;
    document.documentElement.style.overflow = oldOverflow;
    document.body.style.overflow = oldBodyOverflow;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({preventScroll:true});
  }
  function open(image) {
    close(); hero = image; previousFocus = image;
    modal = document.createElement('div'); modal.className = 'agv';
    modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Enlarged image');
    modal.innerHTML = '<div class="agv-header"><p class="agv-caption"></p>' + control('close','✕','Close image') + '</div>' +
      '<div class="agv-stage"><img class="agv-image" draggable="false"></div><div class="agv-footer"><div class="agv-controls">' +
      control('out','−','Zoom out') + '<span class="agv-zoom" aria-live="polite"></span>' + control('in','+','Zoom in') +
      control('fit','Fit','Fit image') + '</div><p class="agv-hint">Scroll or pinch to zoom · Drag to move</p></div>';
    modal.querySelector('.agv-caption').textContent = image.alt || image.closest('figure').querySelector('[data-caption]')?.textContent || '';
    stage = modal.querySelector('.agv-stage'); picture = modal.querySelector('img'); readout = modal.querySelector('.agv-zoom');
    picture.alt = image.alt; picture.onload = fit;
    // This is the same full media asset as the hero, never the thumbnail crop.
    picture.src = image.currentSrc || image.src;
    oldOverflow = document.documentElement.style.overflow; oldBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';
    document.body.appendChild(modal); fitWidth = 0; zoom = 1; x = y = 0;
    if (picture.complete) fit();
    modal.querySelector('[data-agv=close]').focus({preventScroll:true});
    stage.addEventListener('wheel', function(e) {
      consume(e); var r = stage.getBoundingClientRect();
      zoomAt(zoom * Math.exp(-Math.max(-300,Math.min(300,e.deltaY)) * .003), e.clientX-r.left,e.clientY-r.top);
    }, {passive:false});
    function startGesture() {
      var ps = Array.from(pointers.values());
      gesture = {zoom:zoom,x:x,y:y,points:ps};
    }
    stage.addEventListener('pointerdown', function(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      consume(e); stage.setPointerCapture(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); startGesture();
    });
    stage.addEventListener('pointermove', function(e) {
      if (!pointers.has(e.pointerId)) return;
      consume(e); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      var ps = Array.from(pointers.values()), gs = gesture.points;
      if (ps.length === 1) { x = gesture.x + ps[0].x-gs[0].x; y = gesture.y + ps[0].y-gs[0].y; paint(); }
      else {
        var d0 = Math.hypot(gs[0].x-gs[1].x,gs[0].y-gs[1].y);
        var d1 = Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
        if (!d0) return;
        var r = stage.getBoundingClientRect(), cx0 = (gs[0].x+gs[1].x)/2-r.left-r.width/2, cy0 = (gs[0].y+gs[1].y)/2-r.top-r.height/2;
        zoom = Math.max(1,Math.min(8,gesture.zoom*d1/d0)); var k = zoom/gesture.zoom;
        x = (gesture.x-cx0)*k+(ps[0].x+ps[1].x)/2-r.left-r.width/2;
        y = (gesture.y-cy0)*k+(ps[0].y+ps[1].y)/2-r.top-r.height/2; paint();
      }
    });
    function endPointer(e) { if (!pointers.has(e.pointerId)) return; consume(e); pointers.delete(e.pointerId); startGesture(); }
    stage.addEventListener('pointerup',endPointer); stage.addEventListener('pointercancel',endPointer);
    stage.addEventListener('dblclick',function(e) { consume(e); var r=stage.getBoundingClientRect(); zoomAt(zoom>1?1:2.5,e.clientX-r.left,e.clientY-r.top); });
    observer = new MutationObserver(function() { if (!hero.isConnected) close(); });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  function click(e) {
    if (modal) {
      if (!modal.contains(e.target)) { consume(e); return; }
      var b = e.target.closest('[data-agv]'); consume(e);
      if (b) { var a=b.dataset.agv; if(a==='close')close(); else if(a==='fit')fit(); else zoomAt(zoom*(a==='in'?1.5:1/1.5)); }
    } else { var image=e.target.closest(selector); if(image) {consume(e);open(image);} }
  }
  function key(e) {
    if (!modal) {
      if ((e.key==='Enter'||e.key===' ') && e.target.matches(selector)) {consume(e);open(e.target);} return;
    }
    // Keep reviewer grading/reveal shortcuts out of the modal.
    consume(e);
    if(e.key==='Escape')close();
    else if(e.key==='+'||e.key==='=')zoomAt(zoom*1.5);
    else if(e.key==='-')zoomAt(zoom/1.5);
    else if(e.key==='0')fit();
    else if(e.key==='ArrowLeft'){x+=60;paint();} else if(e.key==='ArrowRight'){x-=60;paint();}
    else if(e.key==='ArrowUp'){y+=60;paint();} else if(e.key==='ArrowDown'){y-=60;paint();}
    else if(e.key==='Tab') {
      var bs=Array.from(modal.querySelectorAll('a')),i=bs.indexOf(document.activeElement);
      bs[(i+(e.shiftKey?-1:1)+bs.length)%bs.length].focus();
    } else if(e.key==='Enter'||e.key===' ') document.activeElement.click();
  }
  function keyup(e) { if(modal) consume(e); }
  function resize() { if(modal)fit(); }
  document.querySelectorAll(selector).forEach(function(i) { i.setAttribute('tabindex','0'); i.setAttribute('role','button'); i.setAttribute('title','Enlarge image'); i.setAttribute('aria-label','Enlarge image: '+i.alt); });
  document.addEventListener('click',click,true); document.addEventListener('keydown',key,true); document.addEventListener('keyup',keyup,true);
  window.addEventListener('resize',resize);
  window.ankiGalleryViewer = { destroy:function() { close(); style.remove(); document.removeEventListener('click',click,true); document.removeEventListener('keydown',key,true); document.removeEventListener('keyup',keyup,true); window.removeEventListener('resize',resize); } };
}());
