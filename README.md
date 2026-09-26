# Aleksander Goliunov — racing driver physical coach site

Static one-page site. No build step, no framework.

```
index.html
styles.css
config.js      <- all editable contacts/links/flags live here
main.js
assets/
  favicon.svg
  og.jpg
  img/hero.jpg
  img/about.jpg
```

## Run locally

Just open `index.html` in a browser, or serve it (recommended, so relative
paths and `fetch` behave the same as in production):

```bash
npx serve .
# or
python -m http.server 8080
```

## Where to edit things

- **All text on the page** — directly in `index.html`, inside each
  `<section>`. Sections are commented (Hero, Check your own data, Where
  drivers lose time, The approach, How we work together, Who I work with,
  About, References, Final CTA, Contact).
- **Contacts, links, feature flags** — all in one place: `config.js`.
  - `email`, `instagramUrl` / `instagramHandle`
  - `telegramUrl`, `phone` (optional, empty = hidden)
  - `formspreeId` — currently a placeholder
  - `referencesEnabled` — `false` by default (see "References" below)
- **Photos** — replace `assets/img/hero.jpg` and `assets/img/about.jpg`
  with real photos (same filenames, any aspect ratio close to the
  placeholder works). The hero section looks fine without a photo too —
  it's just the dark grid background.
- **OG / share image** — `assets/og.jpg` (1200×630). Regenerate it with
  your own design once you have real photos/branding.
- **Colors / fonts** — CSS variables at the top of `styles.css` (`:root`).
  There's a reserved `--accent-2` (pink, from Instagram) that isn't used
  anywhere by default — set it as an accent somewhere if you want it.

## Placeholders (`config.js`)

All required values are filled in (Formspree form "Website contact",
id `xkjgqyev`, sends to aleksandrgoliunov@yahoo.com).

`phone` is optional and currently empty (hidden). Fill it in international
format, e.g. `+995500000000`, to show a WhatsApp link.

Until these are filled in, the corresponding link/feature is hidden
automatically — nothing broken shows up on the live site.

## Contact form (Formspree)

1. Create a form at [formspree.io](https://formspree.io) (free tier is
   enough for this volume).
2. Copy the form id from the endpoint they give you
   (`https://formspree.io/f/XXXXXXX` → `XXXXXXX`).
3. Put it in `config.js` as `formspreeId`.

If `formspreeId` is still a placeholder, the form falls back to opening
the visitor's email client with a pre-filled `mailto:` instead of
submitting — so the form always works, even before Formspree is set up.

## References section

Off by default (`referencesEnabled: false` in `config.js`). While off,
the whole "Drivers I've worked with" section is hidden.

Set `referencesEnabled: true` **only after** Louis Perrot, Hjelte Hoffner
and Anastasia Tereshchenko have confirmed they're fine being named
publicly on the site. Once enabled, the section with names/series
appears between About and the final call to action.

## Deploy

### Netlify (recommended, easiest)

1. Push this folder to a GitHub repo (or drag-and-drop the folder into
   [app.netlify.com/drop](https://app.netlify.com/drop) for a one-off deploy).
2. In Netlify: "Add new site" → "Import an existing project" → pick the repo.
3. Build command: none. Publish directory: `/` (root).
4. Deploy.

### GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo → Settings → Pages → Source: `main` branch, `/ (root)`.
3. Save — the site will be live at `https://<username>.github.io/<repo>/`.

### Custom domain (e.g. `goliunov.com`)

- **Netlify**: Site settings → Domain management → Add a domain, then
  point your domain's DNS to Netlify (they show the exact records —
  usually an `A` record to Netlify's load balancer IP or a `CNAME` for a
  subdomain).
- **GitHub Pages**: add a `CNAME` file at the repo root containing just
  `goliunov.com`, then set your domain's DNS `A` records to GitHub Pages'
  IPs (see GitHub's "Managing a custom domain" docs) or a `CNAME` record
  if using a subdomain like `www`.
- Either way, allow up to 24h for DNS + HTTPS certificate to propagate.

## Analytics

Off by default — no cookies, no tracking script. There's a commented-out
Plausible snippet in `index.html`'s `<head>` if you want basic,
privacy-friendly analytics later — just uncomment and set `data-domain`.

## Performance / accessibility checklist

- Run Lighthouse (Chrome DevTools → Lighthouse → Mobile) before going live.
- Images: once you replace the placeholders, export as WebP where
  possible and keep `loading="lazy"` on anything below the fold.
- Contrast, focus states and semantic tags are already in place —
  re-check after any content changes.
