/**
 * PRELAN: mobile menu (Woodcreek style).
 * Standalone on purpose (no Firebase imports) so the menu works even if the
 * Firebase scripts are slow or blocked.
 */
function initMobileNav() {
  const toggleBtn = document.getElementById("mobile-toggle-btn");
  const drawer = document.getElementById("mobile-nav-drawer");
  const closeBtn = document.getElementById("mobile-close-btn");
  const links = document.querySelectorAll(".mobile-nav-item");

  if (!toggleBtn || !drawer) return;

  const header = document.getElementById("site-header");
  const label = toggleBtn.querySelector(".menu-label");

  function openDrawer() {
    // Panel sits directly under the header (Woodcreek style); every group starts expanded.
    drawer.style.setProperty("--hh", (header ? header.offsetHeight : 76) + "px");
    drawer.querySelectorAll("details").forEach(d => { d.open = true; });
    drawer.classList.add("active");
    toggleBtn.setAttribute("aria-expanded", "true");
    if (label) label.textContent = "CLOSE";
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("active");
    toggleBtn.setAttribute("aria-expanded", "false");
    if (label) label.textContent = "MENU";
    document.body.style.overflow = "";
  }

  toggleBtn.addEventListener("click", () => (drawer.classList.contains("active") ? closeDrawer() : openDrawer()));
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  window.addEventListener("resize", () => { if (window.innerWidth >= 1024 && drawer.classList.contains("active")) closeDrawer(); });

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeDrawer();
  });

  links.forEach(link => {
    link.addEventListener("click", closeDrawer);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("active")) {
      closeDrawer();
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMobileNav);
else initMobileNav();
