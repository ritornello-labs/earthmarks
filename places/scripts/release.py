"""Build the public seed without personal collection state or QA fixtures."""
import argparse
import html
import json
import math
from pathlib import Path

import genanki

from build import FIELDS, OUT, ROOT, build

# Public identities, independent of personal and disposable-profile identities.
MODEL_ID = 1986240311
DECK_ID = 1986240312


def release(destination: Path, media: Path):
    places = json.loads((ROOT / 'places/data/places.json').read_text())
    assert len(places) == 704
    identities = set()
    for place in places:
        lat, lon = place['coordinates']
        assert math.isfinite(lat) and math.isfinite(lon)
        assert -90 <= lat <= 90 and -180 <= lon <= 180
        identity = (place['name'], place['context'], lat, lon)
        assert identity not in identities
        identities.add(identity)
    tiles = sorted(media.glob('_places_earth_v1_*.jpg'))
    expected = {f'_places_earth_v1_{z}_{x}_{y}.jpg'
                for z in range(5) for x in range(2 ** z) for y in range(2 ** z)}
    assert {p.name for p in tiles} == expected, 'Incomplete offline imagery'
    templates, css = build()
    # Redistribute the complete license with the bundled library.
    notice = (ROOT / 'licenses/MAPLIBRE.txt').read_text()
    css += '\n/*\n' + notice + '\n*/\n'
    # Anki's package exporter discovers CSS URLs, not JavaScript-built tile URLs.
    # This unused selector retains every shared tile without loading extra images.
    css += '\n.earthmarks-offline-media { background-image: ' + ','.join(
        f'url("{p.name}")' for p in tiles) + '; }\n'
    model = genanki.Model(MODEL_ID, 'Places — Globe',
        fields=[{'name': name} for name in FIELDS],
        templates=[{'name': 'Locate', 'qfmt': templates['front'], 'afmt': templates['back']}],
        css=css)
    description = '''<b>Earthmarks: Find Places on an Interactive Globe</b><br>
Know the name. Find the place.<br><br>
704 cities, one shared offline globe. Add a place using Name and Coordinates
(latitude, longitude). All other fields are optional.<br><br>
AnkiDroid: enable Settings → Advanced → localStorage in study screen to keep
preferences between study sessions. Preferences are device-local; desktop Anki
resets them after a full restart. Requires WebGL; eInk/Boox is not recommended.<br><br>
MIT-licensed source; MapLibre GL JS (BSD), NASA Blue Marble imagery and
public-domain Natural Earth borders retain their respective terms.
Instructions, credits and support:
<a href="https://github.com/ritornello-labs/earthmarks">github.com/ritornello-labs/earthmarks</a>'''
    deck = genanki.Deck(DECK_ID, 'Earthmarks', description=description)
    for place in places:
        lat, lon = place['coordinates']
        fields = {'Name': html.escape(place['name']), 'Coordinates': f'{lat}, {lon}',
                  'Type': html.escape(place.get('type', '')),
                  'Context': html.escape(place.get('context', ''))}
        deck.add_note(genanki.Note(model=model,
            fields=[fields.get(name, '') for name in FIELDS],
            guid=genanki.guid_for('earthmarks-public-v1', place['name'], place['context'], lat, lon)))
    destination.parent.mkdir(parents=True, exist_ok=True)
    package = genanki.Package(deck)
    package.media_files = [str(p) for p in tiles]
    package.write_to_file(str(destination))
    print('Built Earthmarks: 704 new notes/cards, 341 offline tiles.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUT / 'Earthmarks.apkg')
    parser.add_argument('--media', type=Path, default=OUT / 'media')
    args = parser.parse_args()
    release(args.output, args.media)
