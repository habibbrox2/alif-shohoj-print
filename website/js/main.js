// ============================================
// Alif Shohoj Print - Website JavaScript
// ============================================

// Language toggle
let currentLang = 'en';

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'bn' : 'en';
  document.body.classList.toggle('lang-bn-active', currentLang === 'bn');
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = currentLang === 'en' ? 'বাংলা' : 'English';
  }
  localStorage.setItem('preferred-lang', currentLang);
}

// Load preferred language
(function() {
  const saved = localStorage.getItem('preferred-lang');
  if (saved === 'bn') {
    currentLang = 'bn';
    document.body.classList.add('lang-bn-active');
  }
})();

// Navbar scroll effect
window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
  
  // Scroll to top button
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    if (window.scrollY > 300) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  }
});

// Mobile menu toggle
function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  navLinks.classList.toggle('active');
}

// FAQ accordion
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      // Close all
      faqItems.forEach(i => i.classList.remove('active'));
      // Open clicked if it wasn't active
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

// Scroll to top
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Smooth scroll for anchor links
document.addEventListener('DOMContentLoaded', function() {
  // Init FAQ
  initFAQ();
  
  // Set lang toggle text
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = currentLang === 'en' ? 'বাংলা' : 'English';
  }
  
  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close mobile menu
        document.querySelector('.nav-links')?.classList.remove('active');
      }
    });
  });
  
  // Animate on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in');
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.feature-card, .step-card, .doc-card, .stat-card').forEach(el => {
    observer.observe(el);
  });
});

// Download tracking (optional analytics)
function trackDownload(arch) {
  console.log('Download started:', arch);
  // Could add analytics here
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  });
}