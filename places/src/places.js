(function() {
  "use strict";
  const root = Array.from(document.querySelectorAll(".places")).at(-1);
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted="true";
  if (window.__placesDispose) window.__placesDispose();
  const $ = (s) => root.querySelector(s), side = root.dataset.side, key = "places:attempt:v1:" + $("h1").textContent + "|" + $("[data-field=coords]").textContent;
  const store = { get(k, f) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  }, set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
  } };
  const prefs = Object.assign({ borders: false, imagery: "offline", tolerance: 25, gallery: "carousel", wiki: "embed", motion: false }, store.get("places:prefs:v1", {}));
  delete prefs.imagery;
  function coords(text) {
    const parts = text.trim().replace(/,/g, " ").split(/\s+/);
    if (parts.length !== 2) throw Error("Use latitude, longitude in Coordinates.");
    const [lat, lon] = parts.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw Error("Coordinates are outside latitude/longitude bounds.");
    return [lon, lat];
  }
  function distance(a, b) {
    const r = Math.PI / 180, p = (b[1] - a[1]) * r, q = (b[0] - a[0]) * r, h = Math.sin(p / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(q / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }
  function vector(p) {const a=p[1]*Math.PI/180,b=p[0]*Math.PI/180;return [Math.cos(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.sin(a)]}
  function coordinate(v) {return [Math.atan2(v[1],v[0])*180/Math.PI,Math.atan2(v[2],Math.hypot(v[0],v[1]))*180/Math.PI]}
  function routeBetween(a,b) {
    const u=vector(a),v=vector(b),dot=Math.max(-1,Math.min(1,u.reduce((n,x,i)=>n+x*v[i],0))),angle=Math.acos(dot);
    let tangent=v.map((x,i)=>x-dot*u[i]);let len=Math.hypot(...tangent);
    if(len<1e-8){const axis=Math.abs(u[2])<.8?[0,0,1]:[0,1,0];tangent=[u[1]*axis[2]-u[2]*axis[1],u[2]*axis[0]-u[0]*axis[2],u[0]*axis[1]-u[1]*axis[0]];len=Math.hypot(...tangent)}
    tangent=tangent.map(x=>x/len);
    const points=Array.from({length:97},(_,i)=>coordinate(u.map((x,k)=>Math.cos(angle*i/96)*x+Math.sin(angle*i/96)*tangent[k])));
    points[0]=a.slice();points[96]=b.slice();
    for(let i=1;i<points.length;i++){while(points[i][0]-points[i-1][0]>180)points[i][0]-=360;while(points[i][0]-points[i-1][0]<-180)points[i][0]+=360}
    return points;
  }
  window.PlacesMath = { coords, distance, routeBetween };
  let target;
  try {
    target = coords($("[data-field=coords]").textContent);
  } catch (e) {
    $(".map-status").textContent = e.message;
    return;
  }
  const rawTolerance = $("[data-field=tolerance]").textContent.trim(), override = rawTolerance === "" ? null : Number(rawTolerance);
  if (override !== null && (!Number.isFinite(override) || override <= 0 || override > 2e4)) {
    $(".map-status").textContent = "Tolerance km must be a positive number up to 20000.";
    return;
  }
  let attempt = side === "back" ? store.get(key, null) : null;
  if (side === "front") {
    attempt = { guess: null, center: [0, 18], zoom: 0.6, bearing: 0 };
    store.set(key, attempt);
  }
  attempt = attempt || { guess: null, center: [0, 18], zoom: 0.6, bearing: 0 };
  let map, guessMarker, correctMarker, disposed = false, observer;
  const localAttempts=window.__placesAttempts||(window.__placesAttempts={});
  if(side==='back'&&localAttempts[key])attempt=JSON.parse(JSON.stringify(localAttempts[key]));
  if(side==='back'&&!attempt.guess){attempt.guess=attempt.center.slice();attempt.implicit=true}
  let suppressPinClickUntil=0;
  function clearGuess(){if(side!=='front')return;attempt.guess=null;attempt.implicit=false;guessMarker?.remove();guessMarker=null;save();report()}

  function comparison() {
    if(side!=='back')return;
    const points=attempt.guess?routeBetween(attempt.guess,target):[target];
    const center=points[Math.floor(points.length/2)];
    const km=attempt.guess?distance(attempt.guess,target):0;
    const angle=Math.max(.02,km/6371);
    const width=$('.globe').clientWidth,height=Math.max(160,$('.globe').clientHeight-120);
    const span=Math.max(1e-4,Math.sin(Math.min(Math.PI,angle)/2));
    // Globe radius grows with 2^zoom. Fit the arc with space for both marker heads.
    const zoom=Math.min(10,Math.max(-.3,Math.log2(Math.min(width,height)*.70/(512*span))));
    map.easeTo({center,zoom:km<.01?8:zoom,bearing:0,pitch:0,duration:prefs.motion?0:1400,easing:t=>t*t*(3-2*t)});
  }
  function save() {
    if (map) {
      attempt.center = map.getCenter().toArray();
      attempt.zoom = map.getZoom();
      attempt.bearing = map.getBearing();
    }
    localAttempts[key]=JSON.parse(JSON.stringify(attempt));
    store.set(key, attempt);
  }
  function report() {
    const tol = override ?? prefs.tolerance;
    if (side === "front") {
      $(".result").textContent = attempt.guess ? "Pin placed · click it again to remove" : "Using the center crosshair";
      return;
    }
    if (!attempt.guess) {
      $(".result").textContent = "No guess placed · green marks the location.";
      return;
    }
    const d = distance(attempt.guess, target);
    $(".result").innerHTML = `<div class="distance-head"><strong class="${d > tol ? "miss" : ""}">${d < 1 ? Math.round(d * 1e3) + " m" : d.toLocaleString(void 0, { maximumFractionDigits: 1 }) + " km"}</strong> <span>away</span></div><div class="result-detail">${d <= tol ? "Within" : "Outside"} ${tol} km tolerance · <span class="guess-key">●</span> Your guess · <span class="target-key">●</span> Location</div>`;

  }
  function setGuess(p) {
    if (side !== "front" || disposed) return;
    attempt.implicit=false;
    attempt.guess = [(p[0] + 540) % 360 - 180, Math.max(-90, Math.min(90, p[1]))];
    if (guessMarker) guessMarker.setLngLat(attempt.guess);
    else {
      const el = document.createElement("div");
      el.className = "place-pin";
      el.setAttribute("aria-label", "Your guess");
      guessMarker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(attempt.guess).addTo(map);
      el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(performance.now()>=suppressPinClickUntil)clearGuess()});
      guessMarker.on('dragstart',()=>{suppressPinClickUntil=Infinity});
      guessMarker.on("dragend", () => {
        suppressPinClickUntil=performance.now()+250;
        attempt.guess = guessMarker.getLngLat().toArray();
        save();
        report();
      });
    }
    save();
    report();
  }
  function applyPrefs() {
    if (map && map.getLayer("borders")) map.setLayoutProperty("borders", "visibility", prefs.borders ? "visible" : "none");
    const photos = $(".photos");
    if (photos) {
      $(".photos figure").hidden = prefs.gallery === "stack";
      $(".thumbnails").hidden = prefs.gallery === "stack";
      $(".image-stack").hidden = prefs.gallery !== "stack";
    }
    const frame = $(".wiki iframe");
    if (frame) {
      frame.hidden = prefs.wiki === "link";
      if (!frame.hidden && !frame.src) {
        const url = $(".wiki-link").getAttribute("href");
        try {
          const u = new URL(url);
          if (u.protocol === "https:" && /(^|\.)wikipedia\.org$/.test(u.hostname)) frame.src = u.href;
        } catch {
        }
      }
    }
    report();
  }
  root.querySelectorAll("[data-pref]").forEach((el) => {
    const p = el.dataset.pref;
    el.type === "checkbox" ? el.checked = !!prefs[p] : el.value = prefs[p];
    el.addEventListener("change", () => {
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (p === "tolerance") {
        v = Number(v);
        if (!Number.isFinite(v) || v <= 0 || v > 2e4) {
          el.value = prefs[p];
          return;
        }
      }
      prefs[p] = v;
      store.set("places:prefs:v1", prefs);
      applyPrefs();
    });
  });
  function action(a) {
    if (a === "settings") {
      $(".settings").hidden = !$(".settings").hidden;
      return;
    }
    if (!map) return;
    const duration = prefs.motion ? 0 : 400;
    if (a === "in") map.zoomIn({ duration });
    if (a === "out") map.zoomOut({ duration });
    if (a === "world") map.easeTo({ center: [0, 18], zoom: 0.6, bearing: 0, pitch: 0, duration });
    if (a === "pin") setGuess(map.getCenter().toArray());
    if (a === "clear" && side === "front") {
      clearGuess();
    }
    if (a === "fullscreen") {
      root.classList.toggle("fullscreen");
      map.resize();
    }
    if (a === "target" && side === "back") comparison();
  }
  root.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    action(b.dataset.action);
  }));
  if (side === "back") {
    const b = document.createElement("button");
    b.textContent = "Fit both ↗";
    b.onclick = (e) => {
      e.preventDefault();
      action("target");
    };
    $(".toolbar").append(b);
    for (const a of ["pin", "clear"]) $(`[data-action=${a}]`).hidden = true;
    const images = Array.from(root.querySelectorAll(".raw-images img"));
    if (images.length) {
      let select = function(i) {
        hero.src = images[i].src;
        hero.alt = images[i].alt || "";
        caption.textContent = images[i].alt || "";
        root.querySelectorAll(".thumbnails button").forEach((b2, j) => b2.setAttribute("aria-pressed", String(i === j)));
      };
      $(".photos").hidden = false;
      const hero = $("[data-hero]"), caption = $("[data-caption]");
      images.forEach((im, i) => {
        const b2 = document.createElement("button");
        b2.setAttribute("aria-label", im.alt || "Image " + (i + 1));
        const thumbnail = im.cloneNode();
        b2.append(thumbnail);
        b2.onclick = (e) => {
          e.preventDefault();
          select(i);
        };
        $(".thumbnails").append(b2);
        $(".image-stack").append(im.cloneNode());
      });
      select(0);
    }
  }
  applyPrefs();
  try {
    map = new maplibregl.Map({ container: $(".globe"), center: attempt.center, zoom: attempt.zoom, bearing: attempt.bearing, maxZoom: 17, minZoom: -0.3, pitch: 0, maxPitch: 0, attributionControl: true, style: { version: 8, projection: { type: "globe" }, sources: { localEarth:{type:'raster',tiles:[new URL('_places_earth_v1_',document.baseURI).href+'{z}_{x}_{y}.jpg'],tileSize:1024,maxzoom:4,attribution:'NASA Blue Marble · offline satellite overview'}, boundaries: { type: "geojson", data: window.PLACES_BORDERS } }, layers: [{id:'offline',type:'raster',source:'localEarth',layout:{visibility:'visible'}}, { id: "borders", type: "line", source: "boundaries", layout: { visibility: prefs.borders ? "visible" : "none" }, paint: { "line-color": "#f2eee1", "line-width": 1, "line-opacity": 0.65 } }] }, canvasContextAttributes: { preserveDrawingBuffer: true } });
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.doubleClickZoom.disable();
    map.on("style.load", () => {
      if (disposed) return;
      $(".map-status").textContent = 'Offline satellite · overview detail';
      if (attempt.guess) {
        if (side === "front") setGuess(attempt.guess);
        else {
          const el = document.createElement("div");
          el.className = "place-pin";
          el.setAttribute("aria-label", "Your guess");
          guessMarker = new maplibregl.Marker({ element: el }).setLngLat(attempt.guess).addTo(map);
        }
      }
      if (side === "back") {
        const el = document.createElement("div");
        el.className = "place-pin correct";
        el.setAttribute("aria-label", "Correct location");
        correctMarker = new maplibregl.Marker({ element: el }).setLngLat(target).addTo(map);
        if(attempt.guess){
          const arc=routeBetween(attempt.guess,target);
          map.addSource('comparison',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:arc}}});
          map.addLayer({id:'comparison-glow',type:'line',source:'comparison',paint:{'line-color':'#081321','line-width':7,'line-opacity':.7}});
          map.addLayer({id:'comparison-line',type:'line',source:'comparison',paint:{'line-color':'#ffdb99','line-width':3,'line-opacity':.95}});
        }
        comparison();
      }
      root.dataset.ready = "true";
      report();
    });
    let errorTimer;
    map.on("error", () => {
      clearTimeout(errorTimer);
      errorTimer = setTimeout(() => {
        if (!disposed) $(".map-status").textContent = 'Offline imagery missing · sync media to this device.';
      }, 1e3);
    });
    map.on("click", (e) => {
      if (e.originalEvent?.target?.closest(".maplibregl-marker")) return;
      if(side==='front'&&attempt.guess){const q=map.project(attempt.guess);if(Math.hypot(q.x-e.point.x,q.y-e.point.y)<=18){clearGuess();return}}
      setGuess(e.lngLat.toArray());
    });
    map.on("moveend", save);
    const keyHandler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setGuess(map.getCenter().toArray());
      }
      if (e.key === "Escape" && root.classList.contains("fullscreen")) action("fullscreen");
    };
    $(".globe").addEventListener("keydown", keyHandler);
    const dispose = () => {
      if (disposed) return;
      if(side==='front'&&!attempt.guess){attempt.guess=map.getCenter().toArray();attempt.implicit=true}
      save();
      disposed = true;
      clearTimeout(errorTimer);
      observer?.disconnect();
      map.remove();
    };
    window.__placesDispose = dispose;
    observer = new MutationObserver(() => {
      if (!root.isConnected) dispose();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__places = { map, prefs, attempt, setGuess, distance, comparison, tolerance: () => override ?? prefs.tolerance };
  } catch (e) {
    $(".map-status").textContent = "This globe needs WebGL: " + e.message;
  }
})();
