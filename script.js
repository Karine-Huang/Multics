const root = document.documentElement;
const body = document.body;
const nav = document.querySelector(".nav");
const heroIntro = document.querySelector("[data-hero-intro]");
let stopHeroStreams = () => {};
const heroStreamInDuration = 1800;
const heroStreamOutDuration = 900;
const heroStreamReturnAt = 2000;
const heroTitleRevealAt = heroStreamReturnAt + 55;
const heroTitleHandoffAt = heroStreamReturnAt + heroStreamOutDuration + 1500;
root.style.setProperty("--hero-stream-duration", `${heroStreamOutDuration}ms`);
document.querySelectorAll(".hero-resources a").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (!link.getAttribute("href")) event.preventDefault();
  });
});
function createHeroStreams() {
  const svg = heroIntro.querySelector(".hero-intro-streams");
  const defs = svg.querySelector("defs");
  const container = svg.querySelector("[data-stream-ribbons]");
  const namespace = "http://www.w3.org/2000/svg";
  const element = (name, attributes, parent) => {
    const node = document.createElementNS(namespace, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    parent.append(node);
    return node;
  };

  const glow = element("filter", {
    id: "intro-stream-glow", x: "-30%", y: "-100%", width: "160%", height: "300%",
    "color-interpolation-filters": "sRGB",
  }, defs);
  element("feGaussianBlur", { stdDeviation: "3" }, glow);

  const tracks = [...defs.querySelectorAll("path")].map((path, index) => {
    const length = path.getTotalLength();
    const steps = Math.ceil(length / 2);
    const points = Array.from({ length: steps + 1 }, (_, i) => path.getPointAtLength(length * i / steps));
    const at = (distance) => {
      const position = Math.min(Math.max(distance / length, 0), 1) * steps;
      const i = Math.min(Math.floor(position), steps - 1);
      const fraction = position - i;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * fraction,
        y: points[i].y + (points[i + 1].y - points[i].y) * fraction,
      };
    };
    const gradient = element("linearGradient", {
      id: `intro-stream-light-${index}`, gradientUnits: "userSpaceOnUse",
    }, defs);
    [[0, 0], [0.15, 0.16], [0.35, 0.7], [0.5, 1], [0.65, 0.7], [0.85, 0.16], [1, 0]].forEach(([offset, opacity]) => {
      element("stop", {
        offset, "stop-color": offset === 0.5 ? "#ffd08a" : "#f1b35f", "stop-opacity": opacity,
      }, gradient);
    });
    const group = element("g", {}, container);
    const halo = element("path", {
      fill: `url(#intro-stream-light-${index})`, filter: "url(#intro-stream-glow)", opacity: "0.65",
    }, group);
    const ribbon = element("path", { fill: `url(#intro-stream-light-${index})` }, group);
    return { length, at, gradient, group, halo, ribbon };
  });
  const ease = (progress, x1, y1, x2, y2) => {
    const coordinate = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
    let low = 0, high = 1;
    for (let i = 0; i < 12; i++) {
      const middle = (low + high) / 2;
      if (coordinate(middle, x1, x2) < progress) low = middle;
      else high = middle;
    }
    return coordinate((low + high) / 2, y1, y2);
  };

  let frame = 0;
  let started = 0;
  const draw = (time) => {
    if (!started) started = time;
    const elapsed = time - started;
    const returning = elapsed >= heroStreamReturnAt;
    const duration = returning ? heroStreamOutDuration : heroStreamInDuration;
    const progress = Math.min(Math.max((elapsed - (returning ? heroStreamReturnAt : 0)) / duration, 0), 1);
    const easedTravel = returning
      ? ease(progress, 0.16, 1, 0.3, 1)
      : ease(progress, 0.42, 0, 0.18, 1);
    const travel = returning ? 1 - easedTravel : easedTravel;
    const visibility = Math.min(progress / 0.12, 1) * Math.min((1 - progress) / 0.12, 1);

    tracks.forEach(({ length, at, gradient, group, halo, ribbon }) => {
      const pulseLength = Math.min(180, length * 0.28);
      const center = -pulseLength / 2 + travel * (length + pulseLength);
      const start = center - pulseLength / 2;
      const end = center + pulseLength / 2;
      const from = at(start), to = at(end);
      Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y }).forEach(([key, value]) => gradient.setAttribute(key, value));
      const left = [], right = [];
      for (let i = 0; i <= 40; i++) {
        const fraction = i / 40;
        const distance = start + pulseLength * fraction;
        if (distance < 0 || distance > length) continue;
        const point = at(distance), before = at(distance - 2), after = at(distance + 2);
        const dx = after.x - before.x, dy = after.y - before.y;
        const magnitude = Math.hypot(dx, dy) || 1;
        const width = 2.2 * Math.sin(Math.PI * fraction) ** 1.6;
        left.push(`${(point.x - dy / magnitude * width).toFixed(2)},${(point.y + dx / magnitude * width).toFixed(2)}`);
        right.push(`${(point.x + dy / magnitude * width).toFixed(2)},${(point.y - dx / magnitude * width).toFixed(2)}`);
      }
      const outline = left.length > 1 ? `M${left.join(" L")} L${right.reverse().join(" L")} Z` : "";
      halo.setAttribute("d", outline);
      ribbon.setAttribute("d", outline);
      group.setAttribute("opacity", visibility);
    });
    if (elapsed < heroStreamReturnAt + heroStreamOutDuration) frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}

function startHeroTitleHandoff() {
  const sourceLines = [
    heroIntro?.querySelector(".intro-title-brand"),
    ...heroIntro?.querySelectorAll(".intro-title-main > span") ?? [],
  ].filter(Boolean);
  const targetLines = [
    document.querySelector(".hero-title-brand"),
    ...document.querySelectorAll(".hero-title-main > em"),
  ].filter(Boolean);

  const getTextRect = (element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect();
  };

  sourceLines.forEach((source, index) => {
    const target = targetLines[index];
    if (!target) return;

    const from = getTextRect(source);
    const to = getTextRect(target);
    const translateX = to.left + to.width / 2 - (from.left + from.width / 2);
    const translateY = to.top + to.height / 2 - (from.top + from.height / 2);

    source.animate(
      [
        { translate: "0 0" },
        { translate: `${translateX}px ${translateY}px` },
      ],
      {
        duration: 900,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );
  });

  body.classList.add("hero-intro-settle");
}

function finishHeroIntro() {
  stopHeroStreams();
  body.classList.remove(
    "hero-intro-pending",
    "hero-intro-active",
    "hero-intro-expand",
    "hero-intro-title-expand",
    "hero-intro-settle",
  );
  heroIntro?.remove();
}
const isHeroEntry = window.location.hash === "" || window.location.hash === "#top";
if (isHeroEntry) {
  window.history.scrollRestoration = "manual";
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

const shouldPlayHeroIntro =
  heroIntro &&
  isHeroEntry &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (shouldPlayHeroIntro) {
  let introTimers = [];
  let introCancelled = false;

  const skipIntro = () => {
    introCancelled = true;
    introTimers.forEach(window.clearTimeout);
    finishHeroIntro();
  };

  const startHeroIntro = () => {
    if (introCancelled || window.scrollY >= 20) {
      finishHeroIntro();
      return;
    }

    body.classList.remove("hero-intro-pending");
    body.classList.add("hero-intro-active");
    stopHeroStreams = createHeroStreams();
    introTimers = [
      window.setTimeout(() => body.classList.add("hero-intro-expand"), heroStreamReturnAt),
      window.setTimeout(() => body.classList.add("hero-intro-title-expand"), heroTitleRevealAt),
      window.setTimeout(startHeroTitleHandoff, heroTitleHandoffAt),
      window.setTimeout(finishHeroIntro, heroTitleHandoffAt + 1000),
    ];
  };

  window.addEventListener("wheel", skipIntro, { once: true, passive: true });
  window.addEventListener("touchstart", skipIntro, { once: true, passive: true });
  window.addEventListener("keydown", skipIntro, { once: true });
  document.fonts.ready.then(startHeroIntro);
} else {
  finishHeroIntro();
}

function updateNavAppearance() {
  nav.classList.toggle("scrolled", window.scrollY > 40);
}

updateNavAppearance();
window.addEventListener("scroll", updateNavAppearance, { passive: true });

function swapVideo(video, source) {
  if (video.getAttribute("src") === source) return;
  video.pause();
  video.src = source;
  video.load();
  video.play().catch(() => {});
}

const scaleCases = [
  {
    focusSource: "./assets/videos/scale-6.mp4",
  },
  {
    focusSource: "./assets/videos/scale-8.mp4",
  },
  {
    focusSource: "./assets/videos/scale-10.mp4",
  },
];

const scaleVideo = document.querySelector("[data-scale-video]");
let activeScaleIndex = 0;

function renderScaleVideo() {
  const item = scaleCases[activeScaleIndex];
  swapVideo(scaleVideo, item.focusSource);
}

document.querySelectorAll("[data-scale-index]").forEach((button) => {
  button.addEventListener("click", () => {
    activeScaleIndex = Number(button.dataset.scaleIndex);
    document.querySelectorAll("[data-scale-index]").forEach((tab) => tab.classList.toggle("active", tab === button));
    renderScaleVideo();
  });
});

const resultCatalog = {
  consistency: [
    {
      label: "4 players",
      source: "./assets/videos/consistency-103-v3.mp4",
    },
    {
      label: "6 players",
      source: "./assets/videos/consistency-198-v3.mp4",
    },
  ],
  control: [
    {
      label: "4 players",
      source: "./assets/videos/control-84-focus.mp4",
    },
    {
      label: "6 players",
      source: "./assets/videos/control-more-scene-12-v3.mp4",
    },
  ],
  interference: [
    {
      label: "4 players",
      source: "./assets/videos/interference-128-focus.mp4",
    },
    {
      label: "6 players",
      source: "./assets/videos/interference-14-v3.mp4",
    },
  ],
};

document.querySelectorAll("[data-result]").forEach((story) => {
  const examples = resultCatalog[story.dataset.result];
  const video = story.querySelector("[data-result-video]");
  const placeholder = story.querySelector("[data-result-placeholder]");
  const placeholderTitle = story.querySelector("[data-result-placeholder-title]");
  const missing = story.querySelector("[data-result-missing]");
  const caseLabel = story.querySelector("[data-result-case]");
  const countLabel = story.querySelector("[data-result-count]");
  let index = 0;

  function render() {
    const example = examples[index];
    caseLabel.textContent = example.label;
    countLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(examples.length).padStart(2, "0")}`;
    video.style.aspectRatio = "1.97";
    placeholder.style.aspectRatio = "1.97";

    if (!example.source) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.hidden = true;
      placeholder.hidden = false;
      placeholderTitle.textContent = example.label;
      missing.textContent = example.missing;
      return;
    }

    placeholder.hidden = true;
    video.hidden = false;
    swapVideo(video, example.source);
  }

  story.querySelector("[data-result-next]").addEventListener("click", () => {
    index = (index + 1) % examples.length;
    render();
  });
});

const videoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.target.closest(".player-card, .feature-view, [data-more-case]")) return;
      if (entry.isIntersecting) {
        entry.target.play().catch(() => {});
      } else if (!entry.target.classList.contains("hero-video")) {
        entry.target.pause();
      }
    });
  },
  { threshold: 0.16 },
);

document.querySelectorAll("video").forEach((video) => videoObserver.observe(video));

const figureDialog = document.querySelector(".figure-dialog");
document.querySelector("[data-expand-image]").addEventListener("click", () => figureDialog.showModal());
figureDialog.querySelector(".dialog-close").addEventListener("click", () => figureDialog.close());
figureDialog.addEventListener("click", (event) => {
  if (event.target === figureDialog) figureDialog.close();
});

document.querySelector("[data-copy-citation]").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const citation = document.querySelector("#bibtex").textContent;
  try {
    await navigator.clipboard.writeText(citation);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Select text to copy";
  }
  window.setTimeout(() => {
    button.textContent = "Copy BibTeX";
  }, 1800);
});

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const revealTargets = document.querySelectorAll(
    [
      ".feature-intro",
      ".feature-overview",
      ".feature-story",
      ".abstract-copy",
      ".section-heading",
      ".method-figure",
      ".method-points",
      ".result-story",
      ".scale-tabs",
      ".showcase",
      ".efficiency-panel",
      ".more-example",
      ".citation-box",
    ].join(","),
  );

  revealTargets.forEach((target) => target.classList.add("reveal-item"));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
  const efficiencyCharts = document.querySelector(".efficiency-charts");
  if (efficiencyCharts) {
    const chartObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            entry.target.classList.remove("charts-visible");
          } else if (entry.intersectionRatio >= 0.7) {
            entry.target.classList.add("charts-visible");
          }
        });
      },
      { threshold: [0, 0.7], rootMargin: "-70px 0px -8% 0px" },
    );
    chartObserver.observe(efficiencyCharts);
  }
}
