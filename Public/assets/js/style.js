const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".navigation");

if (menuToggle && navigation) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Buka menu" : "Tutup menu");
    navigation.classList.toggle("is-open", !isOpen);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Buka menu");
      navigation.classList.remove("is-open");
    }
  });
}

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pageLoader = document.querySelector("#page-loader");
if (pageLoader) {
  const loaderStartedAt = performance.now();
  const minLoaderDuration = prefersReducedMotion ? 0 : 1400;
  const loaderFadeDuration = prefersReducedMotion ? 0 : 500;
  let loaderHideScheduled = false;

  const hidePageLoader = () => {
    if (loaderHideScheduled) return;
    loaderHideScheduled = true;
    const remaining = Math.max(0, minLoaderDuration - (performance.now() - loaderStartedAt));
    window.setTimeout(() => {
      pageLoader.classList.add("is-hidden");
      window.setTimeout(() => document.body.classList.remove("is-loading"), loaderFadeDuration);
    }, remaining);
  };

  document.body.classList.add("is-loading");
  if (prefersReducedMotion && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hidePageLoader, { once: true });
  } else if (document.readyState === "complete" || prefersReducedMotion) {
    hidePageLoader();
  } else {
    window.addEventListener("load", hidePageLoader, { once: true });
  }
  window.setTimeout(() => {
    if (!pageLoader.classList.contains("is-hidden")) {
      loaderHideScheduled = false;
      hidePageLoader();
    }
  }, 4000);
}

const revealSelectors = [
  ".promise-item",
  ".collection .section-heading > *",
  ".collection .filter-row",
  ".story-image-wrap",
  ".story-copy > *",
  ".custom-content > *",
  ".footer-brand",
  ".footer-column",
];

if ("IntersectionObserver" in window && !prefersReducedMotion) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-visible", entry.isIntersecting);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

  const observeReveal = (element) => {
    if (element.classList.contains("scroll-reveal")) return;
    const siblingIndex = Array.prototype.indexOf.call(element.parentElement.children, element);
    element.style.setProperty("--reveal-delay", `${Math.min(siblingIndex, 4) * 80}ms`);
    element.classList.add("scroll-reveal");
    revealObserver.observe(element);
  };

  document.querySelectorAll(revealSelectors.join(", ")).forEach(observeReveal);

  const productGrid = document.querySelector("#product-grid");
  if (productGrid) {
    productGrid.querySelectorAll(".product-card").forEach(observeReveal);
    const productObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.matches(".product-card")) {
            observeReveal(node);
          }
        });
      });
    });
    productObserver.observe(productGrid, { childList: true });
  }
}