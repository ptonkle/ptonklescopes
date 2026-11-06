"""Regenerate pikmin.js from Pikipedia (Pikmin 1 to 4).

Usage: python3 -I tools/build_pikmin.py
Needs Pillow (`pip install pillow`). Creatures, treasures and Pikmin types come from the wiki's categories
and page images. Art must be a cutout, not a picture on a background box. A creature must also
be whole, not cut off at an edge; if its page image fails, it falls back to its in-game icon.
Anything still without clean art is left out.
"""
import io, json, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

API = "https://www.pikminwiki.com/api.php"
THUMB = 256
ENEMY_CATS = [f"Category:Pikmin {n} enemies" for n in (1, 2, 3, 4)]
TREASURE_CATS = ["Category:Ship parts", "Category:Pikmin 2 treasures", "Category:Fruits", "Category:Pikmin 4 treasures"]
NOT_TREASURES = {"Fruit", "Ship part", "S.S. Dolphin"}
TYPES = ["Red", "Yellow", "Blue", "Purple", "White", "Rock", "Winged", "Ice", "Glow"]

# Reading category for each family; families not listed are "oddity".
CATEGORY = {
    **dict.fromkeys(["Grub-dog", "Snavian", "Mawdad", "Crawmad", "Mollusking", "Snareshell", "Creep-crab", "Gourdfeather",
                     "Huntinpeck", "Whiskerpillar", "Elips", "Mireclops", "Meerslug", "Onionshell"], "predator"),
    **dict.fromkeys(["Lithopod", "Arachnorb", "Awrapnid", "Scarab beetle", "Sharpshell", "Crushblat", "Heavil",
                     "Shellcake"], "armored"),
    **dict.fromkeys(["Breadbug", "Dweevil", "Mandiblard", "Burrow-nit", "Scarpanid", "Kettlebug", "Mitite", "Numbouse",
                     "Flint beetle", "Glint beetle", "Amphituber", "Skitterling"], "pest"),
    **dict.fromkeys(["Blowhog", "Tusked blowhog", "Jellyfloat", "Goolix", "Sporovid", "Dirigibug", "Chrysanthemum",
                     "Slooch"], "hazard"),
    **dict.fromkeys(["Flutterbie", "Flitterbie", "Honeywisp", "Dandelfly"], "gentle"),
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ptonklescopes data build)"})
    for attempt in range(4):
        try:
            return urllib.request.urlopen(req, timeout=30).read()
        except OSError:
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)


def query(**params):
    return json.loads(get(API + "?" + urllib.parse.urlencode({**params, "format": "json"})))


def is_cutout(url, whole=False):
    alpha = Image.open(io.BytesIO(get(url))).convert("RGBA").getchannel("A")
    w, h = alpha.size
    corners = [alpha.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if sum(a > 128 for a in corners) >= 2:
        return False
    sides = [[alpha.getpixel((x, y)) for x in range(w)] for y in (0, h - 1)]
    sides += [[alpha.getpixel((x, y)) for y in range(h)] for x in (0, w - 1)]
    return not whole or all(sum(a > 128 for a in side) < len(side) * 0.1 for side in sides)


def icon_art(title):
    data = query(action="query", prop="imageinfo", iiprop="url", iiurlwidth=THUMB, titles=f"File:{title}")
    info = next(iter(data["query"]["pages"].values())).get("imageinfo")
    return info and (info[0].get("thumburl") or info[0]["url"])


def members(cat):
    out, more = [], {}
    while True:
        data = query(action="query", list="categorymembers", cmtitle=cat, cmlimit=500, cmtype="page", **more)
        out += [m["title"] for m in data["query"]["categorymembers"]]
        if "continue" not in data:
            return out
        more = {"cmcontinue": data["continue"]["cmcontinue"]}


def pages(titles):
    """Page image and infobox text for each title."""
    found = {}
    for i in range(0, len(titles), 40):
        data = query(action="query", prop="pageimages|revisions", rvprop="content", rvslots="main",
                     pithumbsize=THUMB, pilimit=40, titles="|".join(titles[i:i + 40]))
        for p in data["query"]["pages"].values():
            if "thumbnail" in p:
                found[p["title"]] = {"art": p["thumbnail"]["source"],
                                     "text": p["revisions"][0]["slots"]["main"]["*"]}
    return found


def field(text, name):
    m = re.search(r"^\|\s*%s\s*=\s*(.+)$" % name, text, re.M)
    return re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]|<[^>]+>", r"\1", m.group(1)).strip() if m else ""


titles = sorted({t for c in ENEMY_CATS for t in members(c)})
info = pages(titles)
creatures = []
for t, p in sorted(info.items()):
    if "infobox enemy" in p["text"].lower():
        family = field(p["text"], "family").removesuffix(" family").replace("Unknown", "")
        creatures.append({"name": t, "family": family, "category": CATEGORY.get(family, "oddity"), "art": p["art"],
                          "icon": field(p["text"], "icon")})

titles = sorted({t for c in TREASURE_CATS for t in members(c)} - NOT_TREASURES)
treasures = [{"name": t, "art": p["art"]} for t, p in sorted(pages(titles).items())]



def clean_creature(c):
    if is_cutout(c["art"], whole=True):
        return c
    icon = c["icon"] and icon_art(c["icon"])
    return dict(c, art=icon) if icon and is_cutout(icon, whole=True) else None


def clean_treasure(t):
    return t if is_cutout(t["art"]) else None


with ThreadPoolExecutor(4) as pool:
    clean_creatures = list(pool.map(clean_creature, creatures))
    clean_treasures = list(pool.map(clean_treasure, treasures))
dropped = [a["name"] for a, k in zip(creatures + treasures, clean_creatures + clean_treasures) if not k]
creatures = [{k: v for k, v in c.items() if k != "icon"} for c in clean_creatures if c]
treasures = [t for t in clean_treasures if t]

info = pages([f"{t} Pikmin" for t in TYPES])
types = [{"name": f"{t} Pikmin", "art": info[f"{t} Pikmin"]["art"]} for t in TYPES]

open("pikmin.js", "w").write(
    "// Generated by tools/build_pikmin.py. Do not edit by hand.\n"
    f"export const PIKMIN_CREATURES = {json.dumps(creatures, indent=1)};\n"
    f"export const PIKMIN_TREASURES = {json.dumps(treasures, indent=1)};\n"
    f"export const PIKMIN_TYPES = {json.dumps(types, indent=1)};\n")
print(len(creatures), "creatures,", len(treasures), "treasures,", len(types), "types; no clean art:", dropped)
