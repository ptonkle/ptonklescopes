"""Regenerate pokemon.js: Pokemon, items, moves and abilities from PokeAPI, Gym Leaders and Elite Four from Bulbapedia.

Usage: python3 -I tools/build_pokemon.py
Pictures are pixel sprites. Trainers from Kalos on have no sprites in any game, so they use
their official 2D artwork. Bulbagarden blocks hotlinks, so their pictures are saved in leaders/.
Anything without a picture is left out.
"""
import csv, io, json, os, re, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/"
CRIES = "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/"
BULBA = "https://bulbapedia.bulbagarden.net/w/api.php"
ARCHIVES = "https://archives.bulbagarden.net/w/api.php"
ENGLISH = "9"
LAST_POKEMON = 1025
ITEM_POCKETS = {"misc", "medicine", "pokeballs", "battle", "berries"}
LEADER_SPRITES = ["B2W2", "BW", "HGSS", "Pt", "DP", "FRLG", "E", "RS"]
LEADER_ART = ["Scarlet Violet", "The Indigo Disk", "Sword Shield", "Sun Moon", "Ultra Sun Ultra Moon", "XY",
              "Omega Ruby Alpha Sapphire"]
ELITE_REGIONS = {"Indigo": ("Kanto", "Indigo Plateau"), "Hoenn": ("Hoenn", "Ever Grande City"),
                 "Sinnoh": ("Sinnoh", "Sinnoh League"), "Unova": ("Unova", "Unova League"),
                 "Kalos": ("Kalos", "Kalos League"), "Alola": ("Alola", "Alola League"),
                 "Paldea": ("Paldea", "Paldea League"), "BB": ("Blueberry", "Blueberry League")}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ptonklescopes data build)"})
    for attempt in range(4):
        try:
            return urllib.request.urlopen(req, timeout=60).read()
        except OSError as err:
            if attempt == 3:
                raise RuntimeError(f"{url}: {err}")
            time.sleep(2 + attempt * 3)


def table(name):
    return list(csv.DictReader(io.StringIO(get(CSV + name + ".csv").decode())))


def wiki(base, **params):
    return json.loads(get(base + "?" + urllib.parse.urlencode({**params, "format": "json"})))


def names(name, key):
    return {r[key]: r["name"] for r in table(name) if r["local_language_id"] == ENGLISH}


types = names("type_names", "type_id")


def exists(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0 (ptonklescopes data build)"})
    for attempt in range(4):
        try:
            return urllib.request.urlopen(req, timeout=30).status == 200
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return False
        except OSError:
            pass
        time.sleep(2 + attempt * 3)
    raise RuntimeError(f"{url}: no answer")


def with_sprites(things):
    with ThreadPoolExecutor(12) as pool:
        return [t for t, ok in zip(things, pool.map(exists, [t["art"] for t in things])) if ok]


species = {r["pokemon_species_id"]: r for r in table("pokemon_species_names") if r["local_language_id"] == ENGLISH}
slots = {}
for r in table("pokemon_types"):
    if int(r["pokemon_id"]) <= LAST_POKEMON:
        slots.setdefault(r["pokemon_id"], []).append(types[r["type_id"]])
pokemon = with_sprites([{"name": species[i]["name"], "dex": int(i), "types": slots[i], "genus": species[i]["genus"],
                         "art": f"{SPRITES}pokemon/{i}.png", "cry": f"{CRIES}{i}.ogg"}
                        for i in map(str, range(1, LAST_POKEMON + 1))])

pockets = {r["id"]: r["identifier"] for r in table("item_pockets")}
pocket_of = {r["id"]: pockets[r["pocket_id"]] for r in table("item_categories")}
item_names = names("item_names", "item_id")
items = with_sprites([{"name": item_names[r["id"]], "art": f"{SPRITES}items/{r['identifier']}.png"}
                      for r in table("items")
                      if pocket_of.get(r["category_id"]) in ITEM_POCKETS and r["id"] in item_names
                      and not item_names[r["id"]].startswith("★")])

classes = {r["id"]: r["identifier"] for r in table("move_damage_classes")}
move_names = names("move_names", "move_id")
moves = [{"name": move_names[r["id"]], "type": types[r["type_id"]], "class": classes[r["damage_class_id"]]}
         for r in table("moves")
         if int(r["id"]) < 10000 and r["pp"] and r["id"] in move_names and r["type_id"] in types and r["damage_class_id"]]

ability_names = names("ability_names", "ability_id")
abilities = [ability_names[r["id"]] for r in table("abilities") if r["is_main_series"] == "1" and r["id"] in ability_names]


def leader_rows():
    text = wiki(BULBA, action="parse", page="Gym Leader", prop="wikitext", redirects=1)["parse"]["wikitext"]["*"]
    region = None
    for line in text.splitlines():
        heading = re.search(r"Region:\}\} \{\{color2\|[^|]*\|(\w+)\}\}", line)
        if heading:
            region = heading.group(1)
        if line.startswith("{{gldr"):
            fields = dict(p.split("=", 1) for p in line.strip("{}").split("|") if "=" in p)
            for key in ("ldr", "ldr2"):
                if key in fields:
                    yield fields[key].removesuffix(" (game)"), fields["type"], region, fields["loc"], "Gym Leader"


def elite_rows():
    text = wiki(BULBA, action="parse", page="Elite Four", prop="wikitext", redirects=1)["parse"]["wikitext"]["*"]
    core = text[text.index("==In the core series games=="):text.index("==In the spin-off games==")]
    for part in re.split(r"^===(?=[^=])", core, flags=re.M)[1:]:
        region, city = ELITE_REGIONS[part.split()[0]]
        for name, kind in re.findall(r"\|([^|{}]+)\}\}'''[^\n]*\n\|\{\{tcolor\|(\w+)", part):
            yield name, kind, region, city, "Elite Four"


def file_url(title):
    data = wiki(ARCHIVES, action="query", prop="imageinfo", iiprop="url", iiurlwidth=256, titles=f"File:{title}.png")
    info = next(iter(data["query"]["pages"].values())).get("imageinfo")
    return info and (info[0].get("thumburl") or info[0]["url"])


def leader_art(name):
    file = name.replace("Lt. ", "Lt ")
    return next(filter(None, (file_url(f"Spr {g} {file}") for g in LEADER_SPRITES)), None) \
        or next(filter(None, (file_url(f"{g} {file}") for g in LEADER_ART)), None)


def save_leader(name, url):
    path = "leaders/" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") + ".png"
    open(path, "wb").write(get(url))
    return path


os.makedirs("leaders", exist_ok=True)
people = {}
for row in [*leader_rows(), *elite_rows()]:
    people.setdefault(row[0], row)  # someone in both keeps their Gym Leader row
with ThreadPoolExecutor(6) as pool:
    urls = list(pool.map(leader_art, people))
leaders = [{"name": name, "role": role, "type": kind, "region": region, "city": city,
            "art": save_leader(name, url), "pixel": "/Spr_" in url}
           for (name, kind, region, city, role), url in zip(people.values(), urls) if url]
missing = [name for name, url in zip(people, urls) if not url]

open("pokemon.js", "w").write(
    "// Generated by tools/build_pokemon.py. Do not edit by hand.\n"
    f"export const POKEMON = {json.dumps(pokemon, indent=1, ensure_ascii=False)};\n"
    f"export const POKEMON_ITEMS = {json.dumps(items, indent=1, ensure_ascii=False)};\n"
    f"export const POKEMON_MOVES = {json.dumps(moves, indent=1, ensure_ascii=False)};\n"
    f"export const POKEMON_ABILITIES = {json.dumps(abilities, indent=1, ensure_ascii=False)};\n"
    f"export const GYM_LEADERS = {json.dumps(leaders, indent=1, ensure_ascii=False)};\n")
print(len(pokemon), "Pokemon,", len(items), "items,", len(moves), "moves,", len(abilities), "abilities,",
      len(leaders), "leaders and Elite Four; no picture:", missing)
