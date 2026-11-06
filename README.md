# Ptonklescopes

Daily horoscopes for the games you play. Static site, no build step.

- `index.html`, `styles.css`, `app.js`: the site. Four styles live in `styles.css`, switched by `<html data-theme>`.
- `texts.js`: all horoscope copy.
- `data.js`: generated champion, keystone and TFT trait data. Regenerate with
  `curl -o /tmp/tft.json https://raw.communitydragon.org/latest/cdragon/tft/en_us.json && python3 -I tools/build_data.py /tmp/tft.json`.
  It picks the newest TFT set automatically; add the set's name to `SET_NAMES`.
- `factorio.js`: generated Factorio items and research (base game and Space Age), with icons from the official wiki.
  Regenerate with `python3 -I tools/build_factorio.py` after a Factorio update.
- `pikmin.js`: generated Pikmin creatures, treasures and types (Pikmin 1 to 4), with art from Pikipedia.
  Regenerate with `python3 -I tools/build_pikmin.py` (needs Pillow, so run it from a venv).
- `pokemon.js`: generated Pokémon, items, moves, abilities and Gym Leaders, with sprites from PokeAPI. Leader pictures live in `leaders/`.
  Regenerate with `python3 -I tools/build_pokemon.py`.
- Each mode can restyle the whole page: see the `body[data-mode="factorio"]` rules in `styles.css`.
- New League champions need no rebuild: the page loads the live champion list from Data Dragon.
- A new TFT set's traits use generic lines (`TFT.traitAny`) until their own lines are written in `texts.js`.

Readings are seeded by date and sign, so everyone sees the same horoscope all day.

Run locally: `python3 -m http.server 8642`, then open http://localhost:8642.
