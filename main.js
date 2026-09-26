(function () {
  "use strict";

  function isPlaceholder(value) {
    return !value || /^\[.*\]$/.test(value.trim());
  }

  // ---------- Mobile nav ----------
  var navToggle = document.getElementById("nav-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mobileNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---------- Contact links from CONFIG ----------
  var linkEmail = document.getElementById("link-email");
  var linkInstagram = document.getElementById("link-instagram");
  var linkTelegram = document.getElementById("link-telegram");
  var linkPhone = document.getElementById("link-phone");

  if (linkEmail && CONFIG.email) {
    linkEmail.href = "mailto:" + CONFIG.email;
    linkEmail.textContent = CONFIG.email;
  }
  if (linkInstagram && CONFIG.instagramUrl) {
    linkInstagram.href = CONFIG.instagramUrl;
    linkInstagram.textContent = "Instagram " + CONFIG.instagramHandle;
  }
  if (linkTelegram) {
    if (!isPlaceholder(CONFIG.telegramUrl)) {
      linkTelegram.href = CONFIG.telegramUrl;
      linkTelegram.textContent = "Telegram @" + CONFIG.telegramUrl.split("/").pop();
      linkTelegram.hidden = false;
    }
  }
  if (linkPhone) {
    if (!isPlaceholder(CONFIG.phone)) {
      linkPhone.href = "https://wa.me/" + CONFIG.phone.replace(/[^\d]/g, "");
      linkPhone.textContent = "WhatsApp — " + CONFIG.phone;
      linkPhone.hidden = false;
    }
  }

  // ---------- References toggle ----------
  var refSection = document.getElementById("references");
  if (refSection && CONFIG.referencesEnabled) {
    refSection.hidden = false;
  }

  // ---------- Contact form: Formspree with mailto fallback ----------
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");

  function buildMailto() {
    var name = document.getElementById("f-name").value;
    var email = document.getElementById("f-email").value;
    var role = document.getElementById("f-role").value;
    var series = document.getElementById("f-series").value;
    var message = document.getElementById("f-message").value;

    var body =
      "Name: " + name + "\n" +
      "Email: " + email + "\n" +
      "I am a: " + role + "\n" +
      "Series: " + (series || "-") + "\n\n" +
      message;

    return "mailto:" + CONFIG.email +
      "?subject=" + encodeURIComponent("Website enquiry from " + name) +
      "&body=" + encodeURIComponent(body);
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (isPlaceholder(CONFIG.formspreeId)) {
        window.location.href = buildMailto();
        if (status) status.textContent = "Opening your email client…";
        return;
      }

      status.textContent = "Sending…";
      var data = new FormData(form);

      fetch("https://formspree.io/f/" + CONFIG.formspreeId, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            status.textContent = "Thanks — I'll get back to you shortly.";
          } else {
            throw new Error("Formspree error");
          }
        })
        .catch(function () {
          window.location.href = buildMailto();
          status.textContent = "Couldn't send automatically — opening your email client instead.";
        });
    });
  }

  // ---------- Fade-in on scroll ----------
  var fadeEls = document.querySelectorAll(".fade-in");
  if ("IntersectionObserver" in window && fadeEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    fadeEls.forEach(function (el) { observer.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
