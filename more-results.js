(() => {
  const section = document.querySelector('#more');
  const rows = [...document.querySelectorAll('[data-more-case]')].map(row => ({
    element: row,
    videos: [...row.querySelectorAll('video')],
    toolbar: row.querySelector('.more-playback'),
    playButton: row.querySelector('[data-more-play]'),
    seek: row.querySelector('[data-more-seek]'),
    frameLabel: row.querySelector('[data-more-frame]'),
    status: row.querySelector('[data-more-status]'),
    tiles: [...row.querySelectorAll('[data-action-player]')].map(tile => ({
      keys: [...tile.querySelectorAll('[data-input-bit]')],
      yaw: tile.querySelector('[data-camera-yaw]'),
      pitch: tile.querySelector('[data-camera-pitch]'),
      dot: tile.querySelector('[data-camera-dot]'),
      motion: tile.querySelector('[data-camera-motion]'),
      weaponSwitch: tile.querySelector('.weapon-switch'),
    })),
    data: null,
    lastFrame: -1,
  }));
  if (!section || !rows.length) return;
  let bundledInputs = {};
  const inputBundle = document.querySelector('#more-input-data');
  if (inputBundle) {
    try {
      bundledInputs = JSON.parse(inputBundle.textContent);
    } catch (error) {
      console.warn('Could not read the bundled result controls:', error);
    }
  }
  async function loadInputs(row) {
    const bundled = bundledInputs[row.element.dataset.moreCase];
    if (!bundled) throw new Error('Missing result controls');
    return bundled;
  }
  const videos = rows.flatMap(row => row.videos);
  const master = videos[0];
  const fps = 20;
  const frameCount = Number(rows[0].seek.max) + 1;
  let visible = false;
  let wantsPlayback = true;
  let animationFrame = 0;
  let retryTimer = 0;
  let playPending = false;
  let mediaRequested = false;
  const defaultStatus = '';
  const weaponLabels = {
    taser: 'Taser', rifle: 'Rifle', sniper: 'Sniper', smg: 'SMG',
    shotgun: 'Shotgun', machine_gun: 'Machine gun', pistol: 'Pistol',
    knife: 'Knife', grenade: 'Grenade', objective: 'Objective',
  };
  const loadingStatus = 'Loading synchronized views…';
  const shouldPlay = () => visible && wantsPlayback && !document.hidden;
  const readyToPlay = () => videos.every(video => video.error || video.readyState >= 3);

  function updateMediaStatus() {
    if (!readyToPlay()) return;
    rows.forEach(row => {
      if (row.data && !row.videos.some(video => video.error)) row.status.textContent = defaultStatus;
    });
  }

  function prepareMedia() {
    if (mediaRequested) return;
    mediaRequested = true;
    rows.forEach(row => { if (row.data) row.status.textContent = loadingStatus; });
    videos.forEach(video => {
      video.preload = 'auto';
      video.muted = true;
      video.defaultMuted = true;
      video.poster = video.dataset.poster;
      video.src = video.dataset.src;
      video.load();
    });
  }

  function updateButtons() {
    rows.forEach(row => {
      row.playButton.textContent = wantsPlayback ? 'Pause' : 'Play';
      row.playButton.setAttribute('aria-label', `${wantsPlayback ? 'Pause' : 'Play'} all result videos`);
    });
  }

  function render(force = false) {
    const frame = Math.min(Math.floor(master.currentTime * fps + 0.0001), frameCount - 1);
    rows.forEach(row => {
      if (!force && row.lastFrame === frame) return;
      row.lastFrame = frame;
      row.seek.value = frame;
      row.frameLabel.textContent = `${String(frame + 1).padStart(3, '0')} / ${frameCount}`;
      row.seek.setAttribute('aria-valuetext', `Frame ${frame + 1} of ${frameCount}`);
      if (!row.data) return;
      row.tiles.forEach((tile, index) => {
        const sample = row.data.players[index].frames[frame];
        tile.keys.forEach(key => {
          const active = !!sample && (sample[0] & Number(key.dataset.inputBit)) !== 0;
          key.classList.toggle('active', active);
          if (key.dataset.inputLabel) key.setAttribute('aria-label', `${key.dataset.inputLabel} ${active ? 'active' : 'inactive'}`);
        });
        if (!sample) {
          tile.yaw.textContent = '—';
          tile.pitch.textContent = '—';
          tile.motion.textContent = 'No recorded inputs';
          tile.dot.style.transform = 'translate(0, 0)';
          return;
        }
        const [mask, yaw, pitch, dx, dy] = sample;
        const targets = Object.entries(row.data.weaponClassBits)
          .filter(([, bit]) => (mask & bit) !== 0)
          .map(([name]) => weaponLabels[name] || name);
        tile.weaponSwitch.title = targets.length ? `Switch to ${targets.join(' / ')}` : 'Weapon-class switch action';
        if (targets.length) tile.weaponSwitch.setAttribute('aria-label', `Weapon switch active: ${targets.join(' / ')}`);
        tile.yaw.textContent = `${yaw.toFixed(1)}°`;
        tile.pitch.textContent = `${pitch.toFixed(1)}°`;
        tile.motion.textContent = `Δ yaw ${dx >= 0 ? '+' : ''}${dx.toFixed(1)}°\npitch ${dy >= 0 ? '+' : ''}${dy.toFixed(1)}°`;
        const x = Math.max(-14, Math.min(14, -dx * 3));
        const y = Math.max(-14, Math.min(14, dy * 3));
        tile.dot.style.transform = `translate(${x}px, ${y}px)`;
      });
    });
  }

  function sync() {
    videos.slice(1).forEach(video => {
      if (video.readyState >= 1 && Math.abs(video.currentTime - master.currentTime) > 0.05) {
        video.currentTime = master.currentTime;
      }
    });
  }

  function tick() {
    render();
    if (!master.paused) sync();
    if (visible && !document.hidden) animationFrame = requestAnimationFrame(tick);
  }

  function pause() {
    clearTimeout(retryTimer);
    videos.forEach(video => video.pause());
  }

  async function play() {
    if (!shouldPlay() || playPending) return;
    prepareMedia();
    if (!readyToPlay()) return;
    playPending = true;
    clearTimeout(retryTimer);
    sync();
    videos.forEach(video => { video.muted = true; video.defaultMuted = true; });
    const results = await Promise.allSettled(videos.filter(video => !video.error).map(video => video.play()));
    playPending = false;
    if (!shouldPlay()) {
      pause();
      return;
    }
    sync();
    updateMediaStatus();
    if (results.some(result => result.status === 'rejected')) {
      retryTimer = setTimeout(play, 1000);
    }
  }

  function seekTo(frame) {
    const time = Number(frame) / fps;
    videos.forEach(video => {
      if (video.readyState >= 1) video.currentTime = time;
    });
    render(true);
  }

  rows.forEach(async row => {
    row.toolbar.hidden = false;
    row.playButton.addEventListener('click', () => {
      wantsPlayback = !wantsPlayback;
      if (wantsPlayback) play();
      else pause();
      updateButtons();
    });
    row.element.querySelector('[data-more-restart]').addEventListener('click', () => {
      seekTo(0);
      if (wantsPlayback) play();
    });
    row.seek.addEventListener('input', () => seekTo(row.seek.value));

    try {
      const data = await loadInputs(row);
      if (data.keyboardDim !== 23 || data.fps !== fps || data.frameCount !== frameCount ||
          data.players.length !== row.videos.length ||
          !data.players.every(player => player.frames.length === frameCount)) {
        throw new Error('Action samples do not match player videos');
      }
      row.data = data;
      row.status.textContent = mediaRequested && !readyToPlay() ? loadingStatus : defaultStatus;
      render(true);
    } catch (error) {
      row.status.textContent = 'Source controls unavailable. Videos still play automatically.';
      row.tiles.forEach(tile => { tile.motion.textContent = 'Controls failed to load'; });
      console.warn(`Could not load controls for ${row.element.dataset.moreCase}:`, error);
    }
  });

  videos.forEach(video => {
    video.controls = false;
    video.pause();
    video.addEventListener('loadedmetadata', sync);
    video.addEventListener('canplay', () => {
      updateMediaStatus();
      if (shouldPlay()) play();
    });
    video.addEventListener('error', () => {
      const row = rows.find(item => item.videos.includes(video));
      row.status.textContent = 'A player video could not load. Reload to try again.';
      if (shouldPlay()) play();
    });
  });
  master.addEventListener('seeked', () => { sync(); render(true); });
  master.addEventListener('timeupdate', () => render());
  master.addEventListener('ended', () => {
    seekTo(0);
    if (shouldPlay()) play();
  });
  const preloadObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    prepareMedia();
    preloadObserver.disconnect();
  }, { rootMargin: `${Math.max(400, window.innerHeight)}px 0px` });
  preloadObserver.observe(section);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(animationFrame);
    if (visible) {
      tick();
      play();
    } else pause();
  });
  observer.observe(section);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(animationFrame);
    if (document.hidden) pause();
    else if (visible) {
      tick();
      play();
    }
  });
  updateButtons();
  render(true);
})();
