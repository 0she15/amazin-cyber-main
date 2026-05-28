/* ============================================================
   Amazin Cyber — script.js
   Handles: mobile nav, FAQ accordion, contact form, scroll spy,
   fade-in animations, footer year.
   ============================================================ */

(function () {
  'use strict';

  /* ── Footer year ─────────────────────────────────────────── */
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ── Mobile navigation ───────────────────────────────────── */
  const toggle = document.querySelector('.nav-toggle');
  const menu   = document.getElementById('nav-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      const isOpen = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
      // Prevent body scroll while nav is open on mobile
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when any nav link is clicked
    menu.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation menu');
        document.body.style.overflow = '';
      });
    });

    // Close menu on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        toggle.focus();
      }
    });
  }

  /* ── Scroll spy — active nav link ───────────────────────── */
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link[href^="#"]');

  function updateActiveLink() {
    let current = '';
    const scrollY = window.scrollY + 100; // offset for sticky header

    sections.forEach(function (section) {
      if (scrollY >= section.offsetTop) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });
  updateActiveLink();

  /* ── FAQ accordion ───────────────────────────────────────── */
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    const btn    = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (!btn || !answer) return;

    btn.addEventListener('click', function () {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      // Close all others first
      faqItems.forEach(function (other) {
        if (other === item) return;
        const otherBtn    = other.querySelector('.faq-question');
        const otherAnswer = other.querySelector('.faq-answer');
        if (otherBtn && otherAnswer) {
          otherBtn.setAttribute('aria-expanded', 'false');
          otherAnswer.hidden = true;
        }
      });

      // Toggle this one
      const nowExpanded = !isExpanded;
      btn.setAttribute('aria-expanded', nowExpanded);
      answer.hidden = !nowExpanded;
    });
  });

  /* ── Contact form submission ─────────────────────────────── */
  const form        = document.getElementById('contact-form');
  const successMsg  = document.getElementById('form-success');

  if (form && successMsg) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Basic client-side validation
      const requiredFields = form.querySelectorAll('[required]');
      let valid = true;

      requiredFields.forEach(function (field) {
        field.style.borderColor = ''; // reset
        if (!field.value.trim()) {
          field.style.borderColor = '#f87171';
          valid = false;
        }
      });

      // Email format check
      const emailField = form.querySelector('#email');
      if (emailField && emailField.value.trim()) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(emailField.value.trim())) {
          emailField.style.borderColor = '#f87171';
          valid = false;
        }
      }

      if (!valid) {
        // Focus the first invalid field
        const firstInvalid = form.querySelector('[style*="f87171"]');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Submit to Formspree
      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' },
      })
        .then(function (res) {
          if (res.ok) {
            form.hidden = true;
            successMsg.hidden = false;
            successMsg.focus();
          } else {
            submitBtn.disabled = false;
            alert('Something went wrong. Please email amazincybersolutions@gmail.com directly.');
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          alert('Network error. Please email amazincybersolutions@gmail.com directly.');
        });
    });

    // Clear red border on input
    form.querySelectorAll('input, select, textarea').forEach(function (field) {
      field.addEventListener('input', function () {
        field.style.borderColor = '';
      });
    });
  }

  /* ── Fade-in on scroll (Intersection Observer) ───────────── */
  const fadeEls = document.querySelectorAll('.fade-in');

  if ('IntersectionObserver' in window && fadeEls.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    fadeEls.forEach(function (el) { observer.observe(el); });
  } else {
    // Fallback: show everything immediately if IntersectionObserver not supported
    fadeEls.forEach(function (el) { el.classList.add('visible'); });
  }

})();
