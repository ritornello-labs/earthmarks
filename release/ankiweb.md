---
title: "Earthmarks: Find Places on an Interactive Globe"
tags: geography cities maps globe interactive offline
support_url: https://github.com/ritornello-labs/earthmarks
---

**Know the name. Find the place.**

Find a place on a satellite globe. Reveal the answer and watch your guess meet the real location—with both pins, a connecting arc, and the distance in view.

The deck starts with an arbitrary selection of 704 cities. To add anything else—a city, mountain, temple, or other point on Earth—you only need its coordinates. Give it a name and reuse the same globe; no new maps or other assets are needed.

![Rotate and zoom the globe, place a guess, then reveal San Francisco and the distance in real Anki](https://ritornello.dev/media/ankiweb/2026-11-09-v2/earthmarks/locate-short.gif)

## How to study

- Rotate and zoom, then tap to place a pin. Tap your pin again to remove it.
- Prefer the center crosshair? Leave the pin unset; the center becomes your guess when you reveal.
- Reveal the answer. Orange marks your guess, green marks the location, and the camera shows both with their distance. The globe stays interactive; **Fit both** restores the comparison.
- Use the distance and your chosen tolerance to judge your answer, then grade yourself with Anki's answer buttons.

**704 notes · 704 cards · one placement exercise per place.**

## Make it yours

Country borders start off. Switch them on whenever you want a reference, choose your default tolerance (initially 25 km), or use reduced motion. A place's **Tolerance km** field overrides your default.

![Follow the cursor to open settings, enable country borders, and see the result on the globe](https://ritornello.dev/media/ankiweb/2026-11-09-v2/earthmarks/settings-quick.gif)

## Add a place

Choose the **Places — Globe** note type and fill:

- **Name:** Mount Everest
- **Coordinates:** `27.9881, 86.9250`

Coordinates are **latitude, longitude** in decimal degrees; negative means south or west. Every new note reuses the same offline globe.

Optional fields let you add a place type, context to distinguish namesakes, images, a Wikipedia URL, formatted extra information, or an individual tolerance. Images appear as a clickable thumbnail carousel with an enlarged viewer. Wikipedia can be embedded on the back or shown as a link. Photos, articles, and extra notes are optional additions to the starting set.

A human or an agent can extend the deck using these same fields. Corrections and place suggestions are welcome on GitHub.

## Offline setup

After importing, let Anki finish syncing media. The shared **22.4 MB NASA satellite overview** then works offline, without an add-on or API key. It shows global terrain and coastlines; zooming does not reveal streets or buildings. Optional Wikipedia references need an internet connection.

**AnkiDroid:** To keep your preferences between study sessions, enable **Settings → Advanced → localStorage in study screen**. Without it, the globe still works, but preferences may reset when you leave the study screen.

Preferences are local to each client and do not sync with your collection. Standard desktop Anki resets them after a full application restart.

The globe requires WebGL. Desktop Anki and AnkiMobile on iOS have been tested; core interactions passed AnkiDroid emulator testing. eInk/Boox is not recommended based on user testing. See the repository's device notes for the current testing scope and limitations.

## Credits and source

Built by [Ritornello](https://ritornello.dev/), using NASA Blue Marble imagery, Natural Earth reference borders, and MapLibre GL JS. Both animations were captured in Anki.

Source code is MIT licensed; third-party material retains its own terms. Full credits and instructions are in the repository.

GitHub: [https://github.com/ritornello-labs/earthmarks](https://github.com/ritornello-labs/earthmarks)

Support continued development: [ritornello.dev/support](https://ritornello.dev/support).
