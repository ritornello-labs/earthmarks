"""Capture a synthetic study attempt from a real disposable Anki reviewer."""
import json
import os
from pathlib import Path

from aqt import gui_hooks, mw
from aqt.qt import QTimer

started = False


class Capture:
    def __init__(self):
        self.output = Path(os.environ["EARTHMARKS_CAPTURE_DIR"])
        self.output.mkdir(parents=True, exist_ok=True)
        self.polls = 0
        self.frames = 0
        self.recording = False
        self.finished = False

    def finish(self, ok, detail=""):
        if self.finished:
            return
        self.finished = True
        self.recording = False
        Path(os.environ["ANKI_ADDON_WORKBENCH_RESULT"]).write_text(
            json.dumps({"ok": ok, "detail": detail, "frames": self.frames})
        )
        mw.unloadProfileAndExit()

    def start(self):
        QTimer.singleShot(70000, lambda: self.finish(False, "Capture timed out"))
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
        mw.web.eval(
            "window.__places.map.jumpTo({center:[-119,38],zoom:2.6});"
            "window.__places.setGuess([-115.14,36.17]);"
        )
        QTimer.singleShot(2500, self.front)

    def frame(self):
        if not self.recording or self.finished:
            return
        mw.web.grab().save(str(self.output / f"frame-{self.frames:04d}.png"))
        self.frames += 1
        QTimer.singleShot(120, self.frame)

    def front(self):
        mw.web.grab().save(str(self.output / "front.png"))
        self.recording = True
        self.frame()
        QTimer.singleShot(2000, self.answer)

    def answer(self):
        mw.reviewer._showAnswer()
        QTimer.singleShot(5500, self.back)

    def back(self):
        mw.web.evalWithCallback(
            "({pins:document.querySelectorAll('.place-pin').length,"
            "arc:!!window.__places.map.getLayer('comparison-line'),"
            "result:document.querySelector('.result').textContent})",
            self.verify,
        )

    def verify(self, result):
        mw.web.grab().save(str(self.output / "back.png"))
        self.finish(bool(result and result["pins"] == 2 and result["arc"]), result)


def start():
    global started
    if started:
        return
    started = True
    mw._earthmarks_capture = Capture()
    mw._earthmarks_capture.start()


gui_hooks.main_window_did_init.append(lambda: QTimer.singleShot(1000, start))
QTimer.singleShot(3000, start)
