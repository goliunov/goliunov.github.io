"""Builds /notes/ (index + one page per article) and sitemap.xml.

Articles are adapted from Aleksander's Instagram carousels (@a.goliunov).
Edit the ARTICLES list below, then run:  python tools/build_notes.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://goliunov.github.io"
ASSET_V = "20261022d"
IG = "https://www.instagram.com/a.goliunov/p/"

# Each section: (heading or None, [blocks]); a block is a paragraph string or a list (bullets).
ARTICLES = [
    {
        "slug": "breathing-in-a-six-point-harness",
        "date": "2026-10-12",
        "ig": "DeZwufODDZu",
        "title": "Belts tight. Now breathe into your belly.",
        "seo_title": "Breathing in a six-point harness: why your neck takes the load",
        "description": "A six-point harness blocks belly breathing, so drivers breathe with the neck and shoulders for the whole stint. Where the air can still go, and how to train it.",
        "lead": "Six-point pulled tight and suddenly there's nowhere for a normal breath to go. Most drivers end up breathing through the neck for the whole stint — and blame the neck for it.",
        "sections": [
            ("What happens in the seat", [
                "A six-point sits across your hips and your ribs, and it does exactly what it's built to do. It holds you still.",
                "A belly breath needs the front of you to expand. Under that harness, it can't. So the air goes up instead.",
            ]),
            ("What that actually costs", [
                "Every breath gets taken with your neck and your shoulders. Two hours in the car is somewhere around two thousand breaths. All of them through there.",
            ]),
            ("You already know the signs", [
                "And you blamed something else:",
                ["Neck and jaw burning before half distance",
                 "Shoulders creeping up toward the belts",
                 "Vision going narrow in the last ten minutes",
                 "Higher heart rate for the same lap time"],
            ]),
            ("The belts aren't the problem", [
                "Nobody's loosening your belts. They aren't the problem — they're the rules. So the question was never how to breathe deeper. It's where the air can still go.",
            ]),
            ("Where the air can still go", [
                "Sideways. And into your back.",
                ["Lower ribs widen out to the sides",
                 "Back ribs expand behind you",
                 "Chest and shoulders stay out of it"],
            ]),
            ("How it gets trained", [
                "Not in the car. Standing, before the session, hands on your lower ribs — widen them without letting your chest lift.",
                "Then do it belted in, so the pattern survives the harness.",
            ]),
            ("Breathing carries load", [
                "Breathing isn't the calm part. In the car it carries load. It holds your neck, your eyes and your heart rate together for the whole stint.",
                "Where does your air go once the belts come tight? Has anyone ever actually checked?",
            ]),
        ],
    },
    {
        "slug": "why-drivers-crack-on-the-last-lap",
        "date": "2026-10-06",
        "ig": "DeJ3frLjDng",
        "title": "Why drivers crack on the last lap",
        "seo_title": "Why racing drivers crack on the last lap — and how calm is built",
        "description": "Last-lap mistakes look like nerves, but they usually start hours earlier: heat, tension and fatigue. What the best drivers do differently.",
        "lead": "It looks like nerves. Usually it starts much earlier.",
        "sections": [
            ("The last lap starts hours earlier", [
                "Heat, tension, constant decisions in traffic. Every stint drains the same tank — and the bill arrives at the end.",
            ]),
            ("A tired body makes a nervous mind", [
                "When the body is fatigued, stress tolerance drops. Breathing gets shallow, heart rate climbs, and pressure feels bigger than it really is.",
            ]),
            ("Pressure narrows your vision", [
                "Under stress, attention tunnels. You miss the gap, the mirror, the car diving up the inside.",
            ]),
            ("What champions do differently", [
                ["Save energy in fights that don't matter",
                 "Reset breathing on the straights",
                 "Plan the final laps before they come",
                 "Build a physical base so the body doesn't drag the mind down"],
            ]),
            ("Calm is built, not born", [
                "Composure on the last lap is trained long before race day — in the body, the breath and the head.",
            ]),
        ],
    },
    {
        "slug": "hydration-and-cockpit-heat",
        "date": "2026-09-17",
        "ig": "DdZHC5jCEU5",
        "title": "Why hydration alone won't beat cockpit heat",
        "seo_title": "Why hydration alone won't beat cockpit heat in racing",
        "description": "Drinking more is only half of heat performance in a race car. Heat hits focus before muscles — heat acclimation, pre-cooling and breathing do the rest.",
        "lead": "Most drivers think drinking more is the answer. It's only half of it.",
        "sections": [
            ("The cockpit is a sauna", [
                "In closed cars cockpit temperatures can pass 50°C. Add a fireproof suit and a helmet, and the body fights heat every lap.",
            ]),
            ("Heat hits the brain first", [
                "Before muscles fail, focus drops: slower reactions, missed braking points, more mistakes late in a stint.",
            ]),
            ("Water is necessary, not enough", [
                "Losing around 2% of body weight in fluid already costs performance. But even a fully hydrated driver overheats without heat adaptation.",
            ]),
            ("What actually works", [
                ["Heat acclimation 10–14 days before hot rounds",
                 "Pre-cooling before the stint",
                 "Slow exhales under stress — shallow, tense breathing burns focus"],
            ]),
            ("Heat is trainable", [
                "Your body can learn to handle it, just like braking pressure or G-load.",
            ]),
        ],
    },
    {
        "slug": "sleep-and-recovery-for-racing-drivers",
        "date": "2026-06-13",
        "ig": "DZiVF8-DGRH",
        "title": "Sleep isn't downtime. It's where adaptation happens.",
        "seo_title": "Sleep and recovery for racing drivers: race weekends and jet lag",
        "description": "Sleep is where reflexes and motor patterns consolidate. Why race weekends wreck it, how to reset after travel, and why recovery isn't passive.",
        "lead": "During sleep, your nervous system consolidates everything from training and racing — reflexes, motor patterns, focus. Skip it, and the gains from your sessions don't stick.",
        "sections": [
            ("Deep sleep rebuilds your reaction time", [
                "During deep sleep, growth hormone repairs tissue and your brain clears the metabolic waste that builds up from hours of high-focus driving. This is where real recovery happens.",
            ]),
            ("The 90-minute sleep cycle", [
                "Sleep moves in cycles of roughly 90 minutes. Waking mid-cycle leaves you groggy — even after 8 hours. For drivers, timing sleep matters as much as the hours logged.",
            ]),
            ("Why race weekends wreck your sleep", [
                "Adrenaline, travel, unfamiliar beds, early call times. Race weekends are a perfect storm for poor recovery — right when your body needs it most.",
            ]),
            ("Jet lag and the international calendar", [
                "Flying across time zones disrupts your circadian rhythm — the internal clock controlling alertness, reaction time and recovery speed.",
            ]),
            ("How to reset faster", [
                ["Get morning sunlight immediately on arrival",
                 "Avoid caffeine after 2pm",
                 "Keep a consistent wake time, even on travel days",
                 "Light movement, not heavy training, on arrival day"],
            ]),
            ("Recovery isn't passive", [
                "Biotensegrity-based work before bed — down-regulating breathing, releasing fascia tension — signals your nervous system it's safe to drop into deep sleep.",
            ]),
            ("Train smarter, sleep smarter", [
                "The drivers who recover fastest aren't always the fittest — they're the ones who treat sleep as part of training, not a break from it.",
            ]),
        ],
    },
    {
        "slug": "driving-is-a-prediction-game",
        "date": "2026-01-29",
        "ig": "DUIH3QOjOfc",
        "title": "Driving is a prediction game",
        "seo_title": "Driving is a prediction game: why calibration beats force",
        "description": "Your brain constantly predicts steering force, grip and load. Prediction errors cost energy and create tension. Why racing drivers should train predictability, not just strength.",
        "lead": "Do you see the white triangle? It doesn't exist. Our brain spends a lot of energy filling in things that aren't there — and because of this, we often make mistakes.",
        "sections": [
            ("The Bayesian brain", [
                "Your brain constantly updates its understanding of the world. It combines what you already know with new sensory information to make the best possible predictions.",
            ]),
            ("Every lap is a set of predictions", [
                "Your brain is always predicting: steering force, grip, load, fatigue. More prediction errors means more mental and physical fatigue.",
            ]),
            ("Uncertainty creates tension", [
                "When steering forces feel unpredictable, your brain goes into defensive mode. Breath tightens. Neck overworks. Focus drops.",
            ]),
            ("Calibration beats force", [
                "We don't push harder. We calibrate. Isometric steering work teaches the brain exactly how much force is needed.",
            ]),
            ("The 30–40% rule", [
                "30–40% effort. Not more. Enough to feel the force. Not enough to trigger tension or panic. Calm breath means correct intensity.",
            ]),
            ("Clear signals, stable laps", [
                ["Clear effort → clear prediction",
                 "Clear prediction → less noise",
                 "Less noise → stable laps"],
                "This is brain training, not strength training.",
            ]),
            ("Train predictability", [
                "Stable driving starts with predictable effort. Train your brain to guess less — and you'll last longer in the race.",
            ]),
        ],
    },
    {
        "slug": "endurance-racing-fatigue",
        "date": "2026-01-23",
        "ig": "DT2m4RijPBA",
        "title": "Talent won't save you in a 24-hour race",
        "seo_title": "Endurance racing fitness: why talent won't save you in a 24-hour race",
        "description": "Talent makes you fast, but it doesn't keep you sharp at 3 a.m. Fatigue hits focus before lap time. How endurance drivers should prepare.",
        "lead": "Talent makes you fast. But it doesn't keep you sharp at 3 a.m. In a 24-hour race, the winner is the one who can still perform under fatigue.",
        "sections": [
            ("Your body is the first weak link", [
                "Cars are engineered for endurance. Drivers usually aren't. Neck, grip, core, breathing, posture — these decide how long you stay sharp.",
            ]),
            ("Fatigue kills focus before speed", [
                "Reaction time drops before lap time does. Drivers feel \"okay\", but their brain is already slower. That's where mistakes start.",
            ]),
            ("Consistency beats peak performance", [
                "One fast stint doesn't win a 24-hour race. Being reliable under fatigue does. Same inputs. Same control. Hour after hour.",
            ]),
            ("Preparation is not just gym work", [
                "Endurance prep is about:",
                ["Reducing unnecessary tension",
                 "Stress-proof breathing",
                 "Posture that survives long stints"],
                "This isn't bodybuilding. It's race-specific training.",
            ]),
            ("Train for fatigue, not just speed", [
                "Speed wins laps. Conditioning wins endurance races. The strongest drivers at the finish are the best prepared ones.",
            ]),
        ],
    },
    {
        "slug": "strength-training-for-tall-racing-drivers",
        "date": "2026-01-15",
        "ig": "DTiOo52jPFI",
        "title": "Tall driver? Getting stronger without getting heavier",
        "seo_title": "Strength training for tall racing drivers: strength without mass",
        "description": "Tall drivers carry more load on the neck and core, but every kilo matters. Why gym strength isn't racing strength, and how to train the nervous system instead of muscle size.",
        "lead": "Getting stronger without gaining weight is the biggest challenge for a tall driver.",
        "sections": [
            ("Motorsport rewards light drivers", [
                "Drivers are getting taller, but in motorsport every extra kilo matters. For tall drivers that means:",
                ["More leverage",
                 "Higher load on the neck and core",
                 "Higher risk of unwanted muscle mass"],
                "Getting stronger is not the same as getting heavier.",
            ]),
            ("Gym strength isn't racing strength", [
                "The mistake I see all the time is training like a gym athlete:",
                ["Heavy weights",
                 "Hypertrophy-style sets",
                 "Chasing muscle size"],
                "This makes you stronger — and heavier, which is not optimal for racing performance.",
            ]),
            ("Strength without mass", [
                "Racing performance training is different. The goal is:",
                ["Neural strength",
                 "Joint stability",
                 "Efficient force transfer",
                 "Endurance under load"],
                "Not muscle size. Not bodyweight increase.",
            ]),
            ("Train the nervous system, not muscle size", [
                "How tall drivers should train:",
                ["Bodyweight and minimal external load",
                 "Isometric and eccentric work",
                 "Breathing-based core stability",
                 "Coordination and force control",
                 "Neck, grip, trunk — without bulk"],
                "You get stronger. Your weight stays stable.",
            ]),
            ("Strength is about control, not size", [
                "Especially if you're tall. Improve strength, stay light, perform better on track: train like a racing driver — not a bodybuilder.",
            ]),
        ],
    },
    {
        "slug": "neck-strength-is-not-enough",
        "date": "2026-01-07",
        "ig": "DTNyDnVDOaI",
        "title": "Why neck strength isn't the most important part",
        "seo_title": "Neck training for racing drivers: why a strong neck alone isn't enough",
        "description": "Neck strength matters under G-forces, but a strong neck without a stable core fails faster. Why racing fitness is built stability first, strength second.",
        "lead": "Many believe a strong neck is the ultimate key to racing success. Here's the full picture.",
        "sections": [
            ("The truth about the super neck", [
                "Yes, neck strength matters in motorsport. G-forces, braking, cornering — your head needs support.",
            ]),
            ("But neck strength alone doesn't work", [
                "A strong neck without a stable core is useless.",
            ]),
            ("No foundation, no control", [
                "Think of it like this: your neck is a pole. Your core is the foundation. No foundation — the pole collapses.",
            ]),
            ("The core is your real support system", [
                "You can have a thick, strong neck. But if your torso can't stabilise the load, the neck muscles work overtime and fail faster.",
            ]),
            ("Stability first", [
                "Stability first. Strength second. Build the core, then load the neck. That's how real race fitness is built.",
            ]),
        ],
    },
    {
        "slug": "co2-breathing-and-precise-driving",
        "date": "2026-01-03",
        "ig": "DTE-PLqDIFT",
        "title": "CO₂ and precise driving",
        "seo_title": "CO₂, breathing and precise driving: why breathing affects how you feel the car",
        "description": "Breathing too fast under load lowers CO₂ and pushes the nervous system into survival mode. Why breathing is a control system for precision, not relaxation.",
        "lead": "Why breathing affects how you feel the car.",
        "sections": [
            ("The common mistake", [
                "Many drivers breathe too fast under load. This lowers CO₂ levels in the blood — even if oxygen is sufficient. Less CO₂ doesn't mean better performance.",
            ]),
            ("What CO₂ really does", [
                "CO₂ is not just a waste gas. It regulates the nervous system. Slightly higher CO₂ levels stimulate the vagus nerve and support parasympathetic activity.",
            ]),
            ("Nervous system and driving", [
                "Higher parasympathetic tone means:",
                ["Lower unnecessary muscle tension",
                 "Better heart rate variability",
                 "Calmer visual processing",
                 "More accurate speed and grip perception"],
                "You feel the car instead of fighting it.",
            ]),
            ("Low CO₂ means overreaction", [
                "Chronically low CO₂ (hyperventilation) leads to:",
                ["Sympathetic dominance",
                 "Increased tension",
                 "Delayed reactions",
                 "Distorted sense of speed and load"],
                "The body goes into survival mode.",
            ]),
            ("Takeaway", [
                "Breathing is a control system. Not for relaxation — for precision. Normalise CO₂ tolerance, and the car becomes easier to read at speed.",
            ]),
        ],
    },
    {
        "slug": "why-some-drivers-progress-faster",
        "date": "2025-12-23",
        "ig": "DSnY0THjN8k",
        "title": "Same track time. Why do some drivers progress faster?",
        "seo_title": "Why some racing drivers progress faster with the same track time",
        "description": "Laps and data aren't the whole picture. Drivers who train body, breathing and nervous system off track stay precise when others fade.",
        "lead": "Why do some drivers progress faster than others, even with the same amount of track time?",
        "sections": [
            ("Laps and data aren't the whole picture", [
                "Many drivers focus only on laps and data and ignore physical training off the track:",
                ["No body preparation",
                 "No breathing control",
                 "No nervous system training"],
            ]),
            ("The body as a performance system", [
                "The drivers who progress don't just get fitter. They train their body as a performance system.",
            ]),
            ("Breathing isn't about relaxing", [
                "It controls focus, heart rate and reaction speed — at race pace.",
            ]),
            ("Where the gap appears", [
                "Drivers who train with biotensegrity move differently, breathe differently and stay precise when others fade. This is where the gap appears.",
            ]),
            ("Training off track", [
                "That's the work I do with drivers: online physical performance training, built around your car and your calendar.",
            ]),
        ],
    },
]

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


def nice_date(iso):
    y, m, d = iso.split("-")
    return f"{int(d)} {MONTHS[int(m) - 1]} {y}"


def esc(s):
    return html.escape(s, quote=True)


def head(title, description, url, extra=""):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="theme-color" content="#08110D">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:image" content="{SITE}/assets/og-green.jpg">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{SITE}/assets/og-green.jpg">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v={ASSET_V}">
{extra}</head>
<body>

<header class="site-header">
  <div class="container header-inner">
    <a href="/" class="logo"><span class="logo-plate" aria-hidden="true">AG</span>Aleksander Goliunov</a>
    <nav class="main-nav" aria-label="Primary">
      <a href="/#approach">Approach</a>
      <a href="/#services">Services</a>
      <a href="/notes/">Notes</a>
      <a href="/#reaction">Reaction</a>
      <a href="/#about">About</a>
      <a href="/#contact">Contact</a>
    </nav>
    <button class="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M2 4H16M2 9H16M2 14H16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
  <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile">
    <a href="/#approach">Approach</a>
    <a href="/#services">Services</a>
    <a href="/notes/">Notes</a>
    <a href="/#reaction">Reaction</a>
    <a href="/#about">About</a>
    <a href="/#contact">Contact</a>
  </nav>
</header>
"""


FOOT = f"""
<footer class="site-footer">
  <div class="container">
    <p>© 2026 Aleksander Goliunov · Movement Therapist — Biotensegrity Specialist · Remote worldwide</p>
  </div>
</footer>

<script src="/config.js?v={ASSET_V}"></script>
<script src="/main.js?v={ASSET_V}"></script>
</body>
</html>
"""

CTA = """
    <aside class="article-cta">
      <h2>Want this checked on your own body?</h2>
      <p>A free 15-minute video assessment. No commitment, no equipment needed.</p>
      <a href="/book/" class="btn btn-primary">Book a free assessment</a>
    </aside>"""


def render_blocks(blocks):
    out = []
    for b in blocks:
        if isinstance(b, list):
            out.append("      <ul>\n" + "".join(f"        <li>{esc(i)}</li>\n" for i in b) + "      </ul>")
        else:
            out.append(f"      <p>{esc(b)}</p>")
    return "\n".join(out)


def note_card(a):
    return f"""        <a class="note-card" href="/notes/{a['slug']}/">
          <time datetime="{a['date']}">{nice_date(a['date'])}</time>
          <h3>{esc(a['title'])}</h3>
          <p>{esc(a['description'])}</p>
          <span class="note-more">Read →</span>
        </a>"""


def build_article(a, others):
    url = f"{SITE}/notes/{a['slug']}/"
    ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": a["title"],
        "description": a["description"],
        "datePublished": a["date"],
        "author": {"@type": "Person", "name": "Aleksander Goliunov", "url": SITE + "/"},
        "image": SITE + "/assets/og-green.jpg",
        "mainEntityOfPage": url,
    }
    extra = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n'
    body = []
    for heading, blocks in a["sections"]:
        if heading:
            body.append(f"      <h2>{esc(heading)}</h2>")
        body.append(render_blocks(blocks))
    more = "\n".join(note_card(o) for o in others)
    return head(f"{a['seo_title']} | Aleksander Goliunov", a["description"], url, extra) + f"""
<main>
  <article class="article">
    <div class="container article-inner">
      <a href="/" class="back-home">← Back to home</a>
      <p class="article-meta"><a href="/notes/">Notes</a> · <time datetime="{a['date']}">{nice_date(a['date'])}</time></p>
      <h1>{esc(a['title'])}</h1>
      <p class="article-lead">{esc(a['lead'])}</p>
      <div class="prose">
{chr(10).join(body)}
      </div>
{CTA}
      <p class="article-source">Originally posted on <a href="{IG}{a['ig']}/" target="_blank" rel="noopener">Instagram @a.goliunov</a>.</p>
    </div>
  </article>

  <section class="more-notes">
    <div class="container">
      <h2>More notes</h2>
      <div class="notes-grid">
{more}
      </div>
    </div>
  </section>
</main>
""" + FOOT


def build_index(articles):
    url = f"{SITE}/notes/"
    cards = "\n".join(note_card(a) for a in articles)
    desc = "Notes on physical performance for racing drivers: breathing in the harness, cockpit heat, fatigue in endurance racing, neck and core, sleep and recovery."
    return head("Notes from the paddock — physical performance for racing drivers | Aleksander Goliunov", desc, url) + f"""
<main>
  <section class="notes-hero">
    <div class="container">
      <a href="/" class="back-home">← Back to home</a>
      <p class="eyebrow">Notes from the paddock</p>
      <h1>Physical setup, explained</h1>
      <p class="hero-sub">Short notes on the part of the lap time the car can't fix — breathing, heat, fatigue, strength and recovery.</p>
    </div>
  </section>
  <section class="notes-list">
    <div class="container">
      <div class="notes-grid">
{cards}
      </div>
    </div>
  </section>
</main>
""" + FOOT


def build_sitemap(articles):
    urls = [(SITE + "/", articles[0]["date"]), (SITE + "/reaction/", "2026-10-22"), (SITE + "/book/", "2026-10-22"), (SITE + "/notes/", articles[0]["date"])]
    urls += [(f"{SITE}/notes/{a['slug']}/", a["date"]) for a in articles]
    rows = "".join(f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{d}</lastmod>\n  </url>\n" for u, d in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}</urlset>\n'


def main():
    articles = sorted(ARTICLES, key=lambda a: a["date"], reverse=True)
    notes = ROOT / "notes"
    notes.mkdir(exist_ok=True)
    (notes / "index.html").write_text(build_index(articles), encoding="utf-8", newline="\n")
    for i, a in enumerate(articles):
        others = [articles[(i + k) % len(articles)] for k in (1, 2, 3)]
        d = notes / a["slug"]
        d.mkdir(exist_ok=True)
        (d / "index.html").write_text(build_article(a, others), encoding="utf-8", newline="\n")
    (ROOT / "sitemap.xml").write_text(build_sitemap(articles), encoding="utf-8", newline="\n")
    print(f"built {len(articles)} articles + index + sitemap")


if __name__ == "__main__":
    main()
