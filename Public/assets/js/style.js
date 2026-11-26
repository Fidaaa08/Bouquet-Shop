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

const revealSelectors = [
  ".promise-bar",
  ".collection .section-heading",
  ".collection .filter-row",
  ".story-image-wrap",
  ".story-copy",
  ".custom-content",
  ".footer-brand",
  ".footer-column",
];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if ("IntersectionObserver" in window && !prefersReducedMotion) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

  const observeReveal = (element) => {
    if (element.classList.contains("scroll-reveal")) return;
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