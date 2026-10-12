(() => {
  const section = document.querySelector('#features');
  const bundle = document.querySelector('#feature-scene-data');
  if (!section || !bundle) return;
  const scene = JSON.parse(bundle.textContent);
  const tiles = [...section.querySelectorAll('[data-feature-view]')];
  const hotspots = [...section.querySelectorAll('[data-feature-player]')];
  const points = [...section.querySelectorAll('[data-feature-point]')];
  const leaders = [...section.querySelectorAll('[data-feature-leader]')];
  const videos = tiles.map(tile => tile.querySelector('video'));
  const master = videos[0];
  const status = section.querySelector('[data-feature-status]');
  const mapStage = section.querySelector('.feature-map-stage');
  const deck = section.querySelector('.player-deck');
  const wheel = section.querySelector('.feature-view-wheel');
  let selected = 0;
  let visible = false;
  let requested = false;
  let starting = false;
  let animationFrame = 0;
  let lastFrame = -1;
  let manualUntil = 0;
  const ready = () => videos.every(video => video.readyState >= 3);
  const shouldPlay = () => visible && !document.hidden;

  function selectPlayer(index) {
    selected = (index + tiles.length) % tiles.length;
    index = selected;
    hotspots.forEach((hotspot, i) => {
      hotspot.classList.toggle('active', i === index);
      hotspot.setAttribute('aria-pressed', String(i === index));
    });
    const first = index - index % 4;
    const cardHeight = (wheel.clientWidth - 22) * 9 / 16;
    const step = Math.max(0, Math.min(77, (wheel.clientHeight - 52 - cardHeight) / 3));
    tiles.forEach((tile, i) => {
      const slot = (i - first + tiles.length) % tiles.length;
      const distant = slot > 3;
      const top = 42 + slot * step;
      tile.style.top = `${top}px`;
      tile.style.zIndex = i === index ? 20 : slot + 1;
      tile.classList.toggle('is-distant', distant);
      tile.classList.toggle('active', i === index);
      tile.setAttribute('aria-pressed', String(i === index));
      tile.setAttribute('aria-hidden', String(distant));
      tile.tabIndex = i===index ? 0 : -1;
      tile.inert = distant;
    });
    points.forEach((point, i) => point.classList.toggle('active', i === index));
    leaders.forEach((leader, i) => leader.classList.toggle('active', i === index));
  }
  function inspectPlayer(index) {
    manualUntil=performance.now()+6000;
    selectPlayer(index);
    play();
  }
  hotspots.forEach((hotspot, i) => hotspot.addEventListener('click', () => inspectPlayer(i)));
  tiles.forEach((tile, i) => tile.addEventListener('click', () => inspectPlayer(i)));
  wheel.addEventListener('keydown', event => {
    const actions = {ArrowDown: selected+1, ArrowRight: selected+1, ArrowUp: selected-1, ArrowLeft: selected-1, Home: 0, End: tiles.length-1};
    if (event.key in actions) {
      event.preventDefault(); inspectPlayer(actions[event.key]);
      wheel.focus({preventScroll:true});
    }
    else if (event.key==='Enter' || event.key===' ') {
      const tile=event.target.closest('[data-feature-view]');
      if (tile) { event.preventDefault(); inspectPlayer(Number(tile.dataset.featureView)); }
    }
  });
  let wheelDelta = 0, lastWheelStep = 0;
  wheel.addEventListener('wheel', event => {
    if (Math.abs(event.deltaX)>Math.abs(event.deltaY)) return;
    event.preventDefault();
    const now=performance.now();
    if (now-lastWheelStep<180) return;
    wheelDelta+=event.deltaY*(event.deltaMode===1 ? 40 : event.deltaMode===2 ? 300 : 1);
    if (Math.abs(wheelDelta)>=30) {
      inspectPlayer(selected+Math.sign(wheelDelta));
      wheelDelta=0; lastWheelStep=now;
    }
  }, {passive:false});
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.setInterval(() => {
      if (shouldPlay() && ready() && performance.now()>manualUntil &&
          !deck.matches(':hover') && !deck.contains(document.activeElement)) {
        selectPlayer(selected+1);
      }
    }, 1500);
  }

  function drawScene() {
    const frame = Math.min(scene.frames.length-1, Math.floor((master.currentTime || 0)*scene.fps));
    if (frame === lastFrame) return;
    lastFrame = frame;
    const positions = scene.frames[frame];
    const labels = positions.map(([x,y]) => [x,y-24]);
    const minimumSpacing = Math.max(68, 36 / mapStage.clientWidth * scene.width);
    for (let pass=0; pass<12; pass++) {
      for (let i=0; i<labels.length; i++) for (let j=i+1; j<labels.length; j++) {
        const dx=labels[j][0]-labels[i][0], dy=labels[j][1]-labels[i][1];
        const distance=Math.hypot(dx,dy);
        if (distance < minimumSpacing) {
          const angle=distance ? Math.atan2(dy,dx) : (i+j)*1.1;
          const push=(minimumSpacing-distance)/2;
          labels[i][0]-=Math.cos(angle)*push; labels[i][1]-=Math.sin(angle)*push;
          labels[j][0]+=Math.cos(angle)*push; labels[j][1]+=Math.sin(angle)*push;
        }
      }
    }
    positions.forEach(([x,y], i) => {
      points[i].setAttribute('cx',x); points[i].setAttribute('cy',y);
      const [lx,ly]=labels[i];
      leaders[i].setAttribute('x1',x); leaders[i].setAttribute('y1',y);
      leaders[i].setAttribute('x2',lx); leaders[i].setAttribute('y2',ly);
      hotspots[i].style.left=`${lx/scene.width*100}%`;
      hotspots[i].style.top=`${ly/scene.height*100}%`;
    });
  }

  function pause() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    videos.forEach(video => video.pause());
  }
  function tick() {
    if (!shouldPlay()) return pause();
    const time=master.currentTime;
    videos.slice(1).forEach(video => {
      if (Math.abs(video.currentTime-time) > .08) video.currentTime=time;
    });
    drawScene();
    animationFrame=requestAnimationFrame(tick);
  }
  async function play() {
    if (!shouldPlay() || !ready() || starting || animationFrame) return;
    starting = true;
    const time=master.currentTime;
    videos.forEach(video => { if (Math.abs(video.currentTime-time)>.03) video.currentTime=time; });
    const results=await Promise.allSettled(videos.map(video=>video.play()));
    starting = false;
    if (!shouldPlay()) return pause();
    if (results.some(result=>result.status==='rejected')) {
      pause();
      status.textContent='Click a player to play the views';
      return;
    }
    status.textContent='';
    animationFrame=requestAnimationFrame(tick);
  }
  function prepareMedia() {
    if (requested) return;
    requested=true;
    status.textContent='Loading views…';
    videos.forEach(video => {
      video.addEventListener('canplay', () => {
        if (ready()) { status.textContent=''; play(); }
      });
      video.addEventListener('error', () => { status.textContent='A player view could not load'; });
      video.poster=video.dataset.poster;
      video.src=video.dataset.src;
      video.load();
    });
  }
  master.addEventListener('ended', () => {
    pause(); videos.forEach(video => { video.currentTime=0; });
    lastFrame=-1; drawScene(); play();
  });
  master.addEventListener('seeked', drawScene);
  document.addEventListener('visibilitychange', () => { if (shouldPlay()) play(); else pause(); });
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) prepareMedia();
  }, {rootMargin:'150px 0px'}).observe(section);
  new IntersectionObserver(([entry]) => {
    visible=entry.isIntersecting;
    if (visible) { prepareMedia(); play(); } else pause();
  }, {threshold:.2}).observe(section.querySelector('.feature-overview'));
  new ResizeObserver(() => { lastFrame=-1; drawScene(); }).observe(mapStage);
  new ResizeObserver(() => selectPlayer(selected)).observe(deck);
  selectPlayer(0);
  drawScene();
})();
