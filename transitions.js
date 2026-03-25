/* global barba, gsap, ScrollTrigger, Lenis */

const EASE_PANEL = "cubic-bezier(0.76, 0, 0.24, 1)";

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function navOffset() {
  const nav = qs(".nav");
  const h = nav ? nav.getBoundingClientRect().height : 72;
  return Math.max(0, Math.round(h + 16));
}

function scrollToHash({ immediate = false } = {}) {
  const hash = window.location.hash;
  if (!hash) return;
  const id = decodeURIComponent(hash.replace("#", ""));
  const target = id ? document.getElementById(id) : null;
  if (!target) return;

  const offset = -navOffset();
  if (lenis) {
    lenis.scrollTo(target, { offset, immediate });
  } else {
    const top = target.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: immediate ? "auto" : "smooth" });
  }
}

function setActiveNav() {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  qsa(".nav a[data-nav]").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    const is = href === path || (path === "" && href === "index.html");
    if (is) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

let navScrollBound = false;
function initNavScroll() {
  const nav = qs(".nav");
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle("scrolled", window.scrollY > 8);
  };
  onScroll();
  if (!navScrollBound) {
    navScrollBound = true;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
}

let cursorBound = false;
function initCursor() {
  const dot = qs(".cursor-dot");
  const ring = qs(".cursor-ring");
  if (!dot || !ring) return;

  // Hide if coarse pointer
  if (matchMedia("(hover:none), (pointer:coarse)").matches) return;
  if (cursorBound) return;
  cursorBound = true;

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let rx = x;
  let ry = y;

  const speed = 0.18;

  window.addEventListener(
    "mousemove",
    (e) => {
      x = e.clientX;
      y = e.clientY;
    },
    { passive: true },
  );

  function raf() {
    rx += (x - rx) * speed;
    ry += (y - ry) * speed;

    dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  const setHover = (on) => {
    if (on) {
      gsap.to(ring, { width: 50, height: 50, duration: 0.25, ease: "power2.out" });
      gsap.to(dot, { opacity: 0.0, duration: 0.2, ease: "power2.out" });
    } else {
      gsap.to(ring, { width: 14, height: 14, duration: 0.25, ease: "power2.out" });
      gsap.to(dot, { opacity: 1.0, duration: 0.2, ease: "power2.out" });
    }
  };

  // Delegate hoverables
  document.addEventListener(
    "pointerover",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("a, button, [data-cursor='hover']")) setHover(true);
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerout",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("a, button, [data-cursor='hover']")) setHover(false);
    },
    { passive: true },
  );
}

let lenis;
function initLenis() {
  if (prefersReducedMotion()) return;
  if (!window.Lenis) return;

  if (lenis) {
    lenis.destroy();
    lenis = null;
  }

  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    smoothTouch: false,
    lerp: 0.085,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Keep ScrollTrigger in sync
  if (window.ScrollTrigger) {
    lenis.on("scroll", ScrollTrigger.update);
  }
}

function killScrollTriggers() {
  if (!window.ScrollTrigger) return;
  ScrollTrigger.getAll().forEach((st) => st.kill());
  ScrollTrigger.clearMatchMedia && ScrollTrigger.clearMatchMedia();
}

function resetScroll() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

function playPreloaderOnce() {
  const pre = qs("#preloader");
  const sweep = qs("#preloader .sweep");
  if (!pre || !sweep) return;

  if (sessionStorage.getItem("ab_preloaded") === "1") {
    pre.style.display = "none";
    return;
  }
  sessionStorage.setItem("ab_preloaded", "1");

  gsap.set(pre, { autoAlpha: 1 });
  gsap.set(sweep, { xPercent: 0 });

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.to(pre, { autoAlpha: 0, duration: 0.25, ease: "power2.out" });
      setTimeout(() => (pre.style.display = "none"), 450);
    },
  });
  tl.to(sweep, { xPercent: 350, duration: 0.7, ease: "power3.inOut" }).to({}, { duration: 0.08 });
}

function transitionLabelFromHTML(container) {
  const name = container?.dataset?.pageName;
  if (name) return name;
  const h = qs("[data-page-title]", container || document);
  return (h?.textContent || "Loading").trim();
}

function tweenP(target, vars) {
  return new Promise((resolve) => {
    gsap.to(target, {
      ...vars,
      onComplete: () => {
        vars.onComplete && vars.onComplete();
        resolve();
      },
    });
  });
}

function initPageAnimations(container) {
  const ns = container?.dataset?.barbaNamespace || document.body.dataset.barbaNamespace;
  if (!window.gsap) return;
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // Common: wipe reveals
  qsa("[data-wipe]", container).forEach((el) => {
    gsap.set(el, { clipPath: "inset(0 100% 0 0)" });
    gsap.to(el, {
      clipPath: "inset(0 0% 0 0)",
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
      },
    });
  });

  if (ns === "home") {
    const words = qsa("[data-word]", container);
    const rule = qs(".rule", container);
    const group = qs(".group", container);

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(
      words,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.08 },
    );
    if (rule) tl.to(rule, { width: "100%", duration: 0.6 }, "-=0.15");
    if (group) tl.to(group, { opacity: 1, duration: 0.5 }, "-=0.25");

    const arrow = qs(".scroll-arrow", container);
    if (arrow && !prefersReducedMotion()) {
      gsap.to(arrow, { y: 8, duration: 1.2, repeat: -1, yoyo: true, ease: "power1.inOut" });
    }

    // Count-up stats
    qsa("[data-count]", container).forEach((el) => {
      const end = Number(el.getAttribute("data-count") || "0");
      const obj = { v: 0 };
      gsap.to(obj, {
        v: end,
        duration: 1.2,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
        onUpdate: () => {
          el.textContent = Math.round(obj.v).toString();
        },
      });
    });
  }

  if (ns === "overview") {
    // Overview sections wipe-in (inset wipe on the whole block)
    qsa("[data-inset-wipe]", container).forEach((el) => {
      gsap.set(el, { clipPath: "inset(0 100% 0 0)" });
      gsap.to(el, {
        clipPath: "inset(0 0% 0 0)",
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 80%" },
      });
    });
  }

  if (ns === "materials") {
    const cards = qsa(".material", container);
    if (cards.length) {
      gsap.fromTo(
        cards,
        { y: 22, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: cards[0].parentElement, start: "top 78%" },
        },
      );
    }

    // Click-to-preview material images
    const view = qs("[data-material-view]", container);
    const img = qs("[data-material-img]", container);
    const title = qs(".materials-view__title", container);
    const desc = qs(".materials-view__desc", container);
    const grid = qs("[data-materials]", container);

    if (view && img && title && desc && grid) {
      const materials = {
        arduino: {
          title: "Arduino Uno Board",
          desc: "Main controller that reads the microphone input and triggers the servo when the threshold is exceeded.",
          img: "assets/material-arduino-uno.png",
        },
        microphone: {
          title: "Max97814 Microphone Module",
          desc: "Continuously senses ambient sound levels and feeds the signal to the Arduino.",
          img: "assets/material-max97814-microphone.png",
        },
        servo: {
          title: "Servo Motor",
          desc: "Actuator that moves to ring the bell for a set duration.",
          img: "assets/material-servo-motor.png",
        },
        bell: {
          title: "Bell",
          desc: "Provides the audible ring when noise exceeds the threshold.",
          img: "assets/material-bell.png",
        },
        wires: {
          title: "Jumper Wires",
          desc: "Connects the modules and components to the Arduino.",
          img: "assets/material-jumper-wires.png",
        },
        magnet: {
          title: "Magnet",
          desc: "Used as part of the housing/mechanism setup depending on the build.",
          img: "assets/material-magnets.png",
        },
      };

      const setSelected = (key) => {
        const data = materials[key];
        if (!data) return;

        qsa(".material[data-material]", grid).forEach((b) => {
          b.setAttribute("aria-pressed", b.getAttribute("data-material") === key ? "true" : "false");
        });

        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.to(view, { opacity: 0, y: 6, duration: 0.18 })
          .add(() => {
            title.textContent = data.title;
            desc.textContent = data.desc;
            img.setAttribute("src", data.img);
          })
          .to(view, { opacity: 1, y: 0, duration: 0.28 });
      };

      // Default selection = first pressed or first button
      const pressed = qs(".material[aria-pressed='true'][data-material]", grid);
      const first = qs(".material[data-material]", grid);
      setSelected((pressed || first)?.getAttribute("data-material") || "arduino");

      grid.addEventListener("click", (e) => {
        const btn = e.target instanceof Element ? e.target.closest(".material[data-material]") : null;
        if (!btn) return;
        setSelected(btn.getAttribute("data-material"));
      });

      grid.addEventListener("keydown", (e) => {
        if (!(e.target instanceof Element)) return;
        const btn = e.target.closest(".material[data-material]");
        if (!btn) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelected(btn.getAttribute("data-material"));
        }
      });
    }
  }

  if (ns === "design") {
    qsa("[data-fade-up]", container).forEach((el) => {
      gsap.fromTo(
        el,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 80%" },
        },
      );
    });
  }

  if (ns === "team") {
    const members = qsa(".member", container);
    if (members.length) {
      gsap.fromTo(
        members,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: members[0].parentElement, start: "top 78%" },
        },
      );
    }

    // Hover: dim others, glow hovered
    members.forEach((m) => {
      m.addEventListener("mouseenter", () => {
        members.forEach((o) => {
          if (o !== m) o.style.opacity = "0.4";
          else o.style.opacity = "1";
        });
        m.classList.add("glow");
      });
      m.addEventListener("mouseleave", () => {
        members.forEach((o) => (o.style.opacity = "1"));
        m.classList.remove("glow");
      });
    });
  }

  // Refresh triggers after layout settles
  if (window.ScrollTrigger) ScrollTrigger.refresh();
}

function initBarba() {
  const transition = qs("#transition");
  const label = qs("#transition .label");
  if (!window.barba || !transition || !label) return;

  barba.init({
    preventRunning: true,
    transitions: [
      {
        name: "panel-sweep",
        async leave(data) {
          killScrollTriggers();
          label.textContent = transitionLabelFromHTML(data.next?.container || data.current?.container);

          // Sweep in from the left
          gsap.set(transition, { xPercent: -101 });
          await tweenP(transition, {
            xPercent: 0,
            duration: 0.7,
            ease: EASE_PANEL,
          });

          // hold 250ms
          await new Promise((r) => setTimeout(r, 250));
        },
        async enter(data) {
          resetScroll();

          // New page rises beneath
          gsap.fromTo(
            data.next.container,
            { y: 18, opacity: 0.0 },
            { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" },
          );

          // Retract to the right
          await tweenP(transition, {
            xPercent: 101,
            duration: 0.7,
            ease: EASE_PANEL,
          });

          gsap.set(transition, { xPercent: -101 });
        },
        afterEnter(data) {
          setActiveNav();
          initLenis();
          initNavScroll();
          initPageAnimations(data.next.container);
          // If we navigated to index.html#team, scroll there after the transition.
          requestAnimationFrame(() => scrollToHash({ immediate: false }));
        },
      },
    ],
  });
}

function ensureBarbaContainers() {
  // Soft validation for authoring mistakes.
  const wrapper = qs("[data-barba='wrapper']");
  const container = qs("[data-barba='container']");
  if (!wrapper || !container) {
    // still allow site to work without barba; animations init below.
    return;
  }
}

function init() {
  ensureBarbaContainers();
  setActiveNav();
  initNavScroll();
  initCursor();
  initLenis();
  playPreloaderOnce();

  const container = qs("[data-barba='container']");
  initPageAnimations(container || document);
  initBarba();

  // Handle direct loads to an anchor (e.g. index.html#team)
  scrollToHash({ immediate: true });

  // Smooth in-page hash navigation on the same document (no Barba needed)
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[href^='#']") : null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      const id = decodeURIComponent(href.slice(1));
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      history.pushState({}, "", href);
      scrollToHash({ immediate: false });
    },
    { passive: false },
  );
}

window.addEventListener("DOMContentLoaded", init);

