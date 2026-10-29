"""Import the racing drivers Excel into PitCRM (Google Sheet behind tools/crm_api.gs).

Usage:
    python tools/crm_import.py "C:/Users/User/Downloads/racing_db_v9_dedup.xlsx" --dry
    python tools/crm_import.py <xlsx> --out contacts.json
    CRM_API=<web app url> CRM_KEY=<key from Settings!B2> python tools/crm_import.py <xlsx>

Stdlib only. The sheet skips duplicates (same Instagram, or same name + series),
so running it twice is safe. The Excel never goes into this public repo.
"""
import html
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from datetime import date

# from the business plan (section 1): warm contacts and past free clients
WARM = {
    "Laurents Hörr": "Тёплый: делал ему программу на travel week",
    "Valerio Rinicella": "Тёплый контакт",
    "Danial Frost": "Тёплый: Jerez в январе 2027 — контент и знакомства в паддоке",
    "Emil Heyerdahl": "Тёплый контакт",
}
PAST = {
    "Louis Perrot": "Работал бесплатно — попросить отзыв, данные до/после и рекомендации",
    "Hjelte Hoffner": "Работал бесплатно — попросить отзыв, данные до/после и рекомендации",
    "Anastasia Tereshchenko": "Работала бесплатно — попросить отзыв, данные до/после и рекомендации",
    "Danny Buntschu": "Работал бесплатно — попросить отзыв, данные до/после и рекомендации",
    "Nano López": "Считается пилотом — попросить отзыв и данные сейчас; оффер на платное продолжение",
}


def cols(row_xml):
    out = {}
    for ref, cell in re.findall(r'<c r="([A-Z]+)\d+"[^>]*>(.*?)</c>', row_xml, re.S):
        out[ref] = html.unescape(re.sub(r"<[^>]+>", "", cell)).strip()
    return out


def read_drivers(path):
    z = zipfile.ZipFile(path)
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    rows = re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S)
    head = cols(rows[0])
    names = {v: k for k, v in head.items()}
    need = ["First Name", "Last Name", "Series", "Class", "Team", "Car", "Nationality", "Instagram", "Status", "Notes"]
    missing = [n for n in need if n not in names]
    if missing:
        sys.exit("Excel columns not found: %s" % missing)
    return [{n: cols(r).get(names[n], "") for n in need} for r in rows[1:]]


def norm(s):
    s = s.lower()
    for a, b in (("ö", "o"), ("ó", "o"), ("é", "e"), ("ü", "u"), ("á", "a")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def to_contacts(rows):
    today = date.today().isoformat()
    out, skipped = [], 0
    for r in rows:
        first, last, ig = r["First Name"], r["Last Name"], r["Instagram"]
        if not (first or last or ig):
            skipped += 1
            continue
        following = r["Series"] == "Following"
        c = {
            "first": first, "last": last,
            "series": "" if following else r["Series"],
            "class": r["Class"], "team": r["Team"], "car": r["Car"], "nationality": r["Nationality"],
            "instagram": ig,
            "segment": "" if following else "pro",
            "source": "ig_following" if following else "racing_db",
            "notes": "" if r["Notes"].startswith("@") else r["Notes"],
        }
        if r["Status"] == "DM Sent":
            # first DM went out before the CRM existed: back for a new-season message
            c.update(stage="Nurture", next_step=today, fu="3",
                     notes=("; ".join(x for x in [c["notes"], "Первый DM отправлен до CRM (до мая 2026)"] if x)))
        else:
            c["stage"] = "New"
        out.append(c)

    by_name = {norm(c["first"] + " " + c["last"]): c for c in out}
    for group, source in ((WARM, "warm"), (PAST, "past_client")):
        for name, note in group.items():
            c = by_name.get(norm(name))
            if c is None:
                first, last = name.split(" ", 1)
                c = {"first": first, "last": last, "stage": "New", "segment": "pro"}
                out.insert(0, c)
            c["warm"] = "1"
            c["source"] = source
            c["notes"] = "; ".join(x for x in [note, c.get("notes", "")] if x)
            if c.get("stage") == "Nurture":
                c["stage"], c["next_step"] = "New", ""
    return out, skipped


def post(api, body):
    req = urllib.request.Request(api, data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "text/plain;charset=utf-8"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # Apps Script is slow at times
            print("  retry after error:", e)
            time.sleep(5 * (attempt + 1))
    sys.exit("API not reachable")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    contacts, skipped = to_contacts(read_drivers(sys.argv[1]))
    stages = {}
    for c in contacts:
        stages[c["stage"]] = stages.get(c["stage"], 0) + 1
    print("contacts:", len(contacts), "empty rows skipped:", skipped, "by stage:", stages)
    print("warm/past:", [c["first"] + " " + c["last"] for c in contacts if c.get("warm")])
    if "--dry" in sys.argv:
        return
    if "--out" in sys.argv:  # JSON for an import run from the browser, where the key stays
        with open(sys.argv[sys.argv.index("--out") + 1], "w", encoding="utf-8") as f:
            json.dump(contacts, f, ensure_ascii=False)
        return
    api, key = os.environ.get("CRM_API"), os.environ.get("CRM_KEY")
    if not api or not key:
        sys.exit("Set CRM_API and CRM_KEY")
    added = dup = 0
    for i in range(0, len(contacts), 250):
        d = post(api, {"key": key, "action": "import", "contacts": contacts[i:i + 250]})
        if not d.get("ok"):
            sys.exit("API error: %s" % d)
        added += d["added"]
        dup += d["skipped"]
        print("  batch %d: +%d (dupes %d)" % (i // 250 + 1, d["added"], d["skipped"]))
    print("done: added %d, duplicates skipped %d" % (added, dup))


if __name__ == "__main__":
    main()
