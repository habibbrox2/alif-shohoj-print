# Alif Shohoj Print - Official Website

This directory contains the GitHub Pages website for Alif Shohoj Print.

## Structure

```
website/
├── index.html          # Home page (hero + features + download CTA)
├── features.html       # Features page (all feature cards with icons)
├── download.html       # Download page (installer links x64/ia32)
├── docs.html           # Documentation (setup guides + protocol docs)
├── tutorial.html       # Tutorial (step-by-step getting started)
├── faq.html            # FAQ (common questions + answers)
├── contact.html        # Contact (contact form + support info)
├── css/
│   └── style.css       # Warm & friendly theme
├── js/
│   └── main.js         # Language toggle, interactions
└── assets/
    ├── logo.svg         # Brand logo
    ├── hero-illustration.svg  # Hero section illustration
    └── og-image.svg     # Social preview image (1200×630)
```

## SEO & Meta Optimization

### Schema.org Organization JSON-LD (automatically injected via `og-image.svg` metadata)

The website includes structured data for search engines:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Alif Shohoj Print",
  "url": "https://habibbrox2.github.io/alif-shohoj-print/",
  "logo": "https://habibbrox2.github.io/alif-shohoj-print/assets/logo.svg",
  "description": "Windows print-shop POS and local print agent by AAA Tech Solutions",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+880 ...",
    "contactType": "customer support"
  }
}
```

### Open Graph (OG) Tags (for Facebook, LinkedIn, Twitter sharing)

Each page includes these OG meta tags in `<head>`:

- `og:title` - Page title
- `og:description` - Page description (150-160 chars)
- `og:image` - `assets/og-image.svg` (1200×630px)
- `og:url` - Current page URL
- `og:type` - `website`
- `og:locale` - `en_BN` (Bengali English)

### Twitter Cards

- `twitter:card`: `summary_large_image`
- `twitter:title`: Page title
- `twitter:description`: Meta description
- `twitter:image`: `assets/og-image.svg`

### SEO Features Summary

| Feature | Description |
|---|---|
| **Meta descriptions** | Unique for every page (index, features, download, docs, tutorial, faq, contact) |
| **Header hierarchy** | H1 → H2 → H3 semantic structure |
| **Alt text** | All images have descriptive `alt` attributes |
| **Fast loading** | No external dependencies, ~40KB total CSS+JS |
| **Mobile-first** | `@media (max-width: 640px)` breakpoints |
| **Semantic HTML5** | Proper use of `<header>`, `<main>`, `<section>`, `<footer>` |
| **Keywords** | "alif shohoj print", "windows print shop", "pos software", "bangla english" |

## Live URL

https://habibbrox2.github.io/alif-shohoj-print/

## Deployment

The site is deployed automatically via GitHub Actions (`.github/workflows/deploy-pages.yml`) whenever changes are pushed to the `website/` directory.

## Page Overview

- **Home (`index.html`)**: Hero section with brief introduction and CTA, features grid, download links
- **Features (`features.html`)**: Detailed list of all features with icons and descriptions
- **Download (`download.html`)**: Installer links for x64 + ia32 architectures, system requirements
- **Documentation (`docs.html`)**: Setup guides, WebSocket protocol docs, troubleshooting
- **Tutorial (`tutorial.html`)**: Step-by-step instructions for first print job
- **FAQ (`faq.html`)**: Common questions and answers about installation & usage
- **Contact (`contact.html`)**: Contact form and support information

## Development

- Built with HTML5, CSS3, Vanilla JavaScript
- No build step required (plain files)
- Optimized for performance (critical CSS inlined, JS deferred)
- Accessible and semantic HTML
- Bilingual: Bengali (বাংলা) + English toggle

## Credits

- Designed by AAA Tech Solutions
- Developed for Alif Shohoj Print project
- Inspired by modern print-shop UI/UX patterns

--- 

**Last updated**: October 2026

The website provides a comprehensive digital presence for Alif Shohoj Print, making it easy for users to learn about and access the application. All pages are indexed by search engines with proper meta structures.