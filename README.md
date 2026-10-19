# Rift Signs

Daily League of Legends and TFT horoscopes. Static site, no build step.

- `index.html`, `styles.css`, `app.js`: the site. Four styles live in `styles.css`, switched by `<html data-theme>`.
- `texts.js`: all horoscope copy.
- `data.js`: generated champion and TFT trait data. Regenerate with
  `curl -o /tmp/tft.json https://raw.communitydragon.org/latest/cdragon/tft/en_us.json && python3 -I tools/build_data.py /tmp/tft.json`
  (update `SET` in the script when a new TFT set launches).

Readings are seeded by date and sign, so everyone sees the same horoscope all day.

Run locally: `python3 -m http.server 8642`, then open http://localhost:8642.
