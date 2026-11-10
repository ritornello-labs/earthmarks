"""Capture real native reviewer camera and settings demos from synthetic notes."""
import json
import os
import time
from pathlib import Path

from aqt import gui_hooks, mw
from aqt.qt import QTimer, Qt

started = False


class Capture:
    def __init__(self):
        self.output = Path(os.environ["EARTHMARKS_CAPTURE_DIR"])
        self.output.mkdir(parents=True, exist_ok=True)
        self.polls = 0
        self.frames = []
        self.recording = False
        self.finished = False
        self.scene = "hero"
        self.events = []
        self.checks = {}
        self.started_at = time.monotonic()

    def event(self, label):
        self.events.append({"label": label, "time": time.monotonic() - self.started_at})

    def finish(self, ok, detail=""):
        if self.finished:
            return
        self.finished = True
        self.recording = False
        receipt = {"ok": ok, "detail": detail, "frames": self.frames,
                   "events": self.events, "checks": self.checks}
        Path(os.environ["ANKI_ADDON_WORKBENCH_RESULT"]).write_text(json.dumps(receipt))
        (self.output / "capture.json").write_text(json.dumps(receipt))
        mw.unloadProfileAndExit()

    def start(self):
        QTimer.singleShot(90000, lambda: self.finish(False, "Capture timed out"))
        mw.resize(1280, 1000)
        card = mw.col.get_card(mw.col.find_cards('deck:"Places Preview"')[0])
        mw.col.decks.select(card.did)
        mw.moveToState("review")
        QTimer.singleShot(1500, self.poll)

    def poll(self):
        mw.web.evalWithCallback(
            "Boolean(window.__places && document.querySelector('[data-ready=true]'))",
            self.ready,
        )

    def ready(self, ready):
        if not ready:
            self.polls += 1
            if self.polls > 35:
                self.finish(False, "Map did not become ready")
            else:
                QTimer.singleShot(1000, self.poll)
            return
        mw.web.eval("window.__places.map.jumpTo({center:[18,20],zoom:0.4});")
        QTimer.singleShot(2000, self.hero)

    def snapshot(self, name):
        pixmap = mw.web.grab()
        # Crop only the native card through its toolbar; omit synthetic gallery fixtures.
        ratio = pixmap.width() / mw.web.width()
        pixmap = pixmap.copy(0, 0, pixmap.width(), min(pixmap.height(), round(750 * ratio)))
        pixmap = pixmap.scaledToWidth(960, Qt.TransformationMode.SmoothTransformation)
        pixmap.save(str(self.output / name))

    def frame(self):
        if not self.recording or self.finished:
            return
        name = f"{self.scene}-{len(self.frames):04d}.png"
        timestamp = time.monotonic() - self.started_at
        self.snapshot(name)
        self.frames.append({"file": name, "time": timestamp, "scene": self.scene})
        QTimer.singleShot(80, self.frame)

    def camera(self, label, center, zoom, duration):
        self.event(label)
        mw.web.eval("window.__places.map.easeTo(" + json.dumps({
            "center": center, "zoom": zoom, "duration": duration,
            "bearing": 0, "pitch": 0, "essential": True,
        }) + ");")

    def hero(self):
        self.event("hero-start")
        self.snapshot("hero-front.png")
        self.recording = True
        self.frame()
        QTimer.singleShot(1200, lambda: self.camera("rotate-to-americas", [-85, 24], 0.7, 1200))
        QTimer.singleShot(2600, lambda: self.camera("zoom-to-west-coast", [-124, 41], 2.0, 900))
        QTimer.singleShot(3700, lambda: self.camera("zoom-in", [-119, 38], 2.9, 800))
        QTimer.singleShot(4700, self.place)
        QTimer.singleShot(6100, self.answer)

    def place(self):
        self.event("place-guess")
        mw.web.eval("window.__places.setGuess([-115.14,36.17]);")

    def answer(self):
        self.event("reveal-answer")
        mw.reviewer._showAnswer()
        QTimer.singleShot(4900, self.hero_done)

    def hero_done(self):
        self.recording = False
        self.snapshot("hero-back.png")
        mw.web.evalWithCallback(
            "({pins:document.querySelectorAll('.place-pin').length,"
            "arc:!!window.__places.map.getLayer('comparison-line'),"
            "result:document.querySelector('.result').textContent})", self.settings_start)

    def settings_start(self, result):
        self.checks["hero"] = result
        if not result or result["pins"] != 2 or not result["arc"]:
            self.finish(False, "Missing hero comparison")
            return
        # The second scene is a fresh, explicitly synthetic Paris practice card.
        # Never carry San Francisco's answer/distance into a different map view.
        note = mw.reviewer.card.note()
        for field, value in {"Name": "Paris", "Coordinates": "48.8566, 2.3522",
                             "Type": "City", "Context": "France", "Images": "",
                             "Extra": "", "Wikipedia URL": ""}.items():
            note[field] = value
        mw.col.update_note(note)
        mw.reviewer.card = mw.col.get_card(mw.reviewer.card.id)
        self.scene = "settings"
        mw.reviewer._showQuestion()
        QTimer.singleShot(1800, self.settings_ready)

    def settings_ready(self):
        mw.web.evalWithCallback(
            "Boolean(document.querySelector('.places[data-side=front][data-ready=true]'))",
            self.settings_map)

    def settings_map(self, ready):
        if not ready:
            QTimer.singleShot(500, self.settings_ready)
            return
        mw.web.eval("window.__places.map.jumpTo({center:[0,35],zoom:2.1});")
        QTimer.singleShot(1800, self.settings_record)

    def settings_record(self):
        self.event("settings-start")
        self.recording = True
        self.frame()
        QTimer.singleShot(1000, self.open_settings)
        QTimer.singleShot(2900, self.borders_on)
        QTimer.singleShot(5500, self.close_settings)
        QTimer.singleShot(8500, self.settings_done)

    def open_settings(self):
        self.event("open-settings")
        mw.web.eval("document.querySelector('[data-action=settings]').click();")

    def borders_on(self):
        self.event("enable-borders")
        mw.web.eval("document.querySelector('[data-pref=borders]').click();")
        QTimer.singleShot(900, lambda: self.snapshot("settings-open.png"))

    def close_settings(self):
        self.event("close-settings-show-borders")
        mw.web.eval("document.querySelector('.settings [data-action=settings]').click();")
        QTimer.singleShot(1000, lambda: self.snapshot("settings-borders-on.png"))

    def settings_done(self):
        self.recording = False
        mw.web.evalWithCallback(
            "({borders:window.__places.map.getLayoutProperty('borders','visibility'),"
            "checked:document.querySelector('[data-pref=borders]').checked,"
            "menuClosed:document.querySelector('.settings').hidden})", self.verify)

    def verify(self, result):
        self.checks["settings"] = result
        self.finish(bool(result and result["borders"] == "visible" and result["checked"]
                         and result["menuClosed"]), result)


def start():
    global started
    if started:
        return
    started = True
    mw._earthmarks_capture = Capture()
    mw._earthmarks_capture.start()


gui_hooks.main_window_did_init.append(lambda: QTimer.singleShot(1000, start))
QTimer.singleShot(3000, start)
