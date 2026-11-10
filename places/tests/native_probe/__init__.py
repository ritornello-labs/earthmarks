"""Synthetic-only native WebGL and answer-transition probe."""
import json,os
from pathlib import Path
from aqt import mw,gui_hooks
from aqt.qt import QTimer
started=False
class Probe:
 def __init__(self):self.done=False;self.polls=0;self.checks=[];self.side='front'
 def finish(self,ok,detail=''):
  if self.done:return
  self.done=True
  Path(os.environ['ANKI_ADDON_WORKBENCH_RESULT']).write_text(json.dumps(dict(ok=ok,checks=self.checks,detail=detail)))
  mw.unloadProfileAndExit()
 def start(self):
  QTimer.singleShot(45000,lambda:self.finish(False,'Native reviewer timeout'))
  print('PLACES: starting native review',flush=True)
  try:
   self.card=mw.col.get_card(mw.col.find_cards('deck:"Places Preview"')[0]);print('PLACES: card selected',flush=True)
   mw.col.decks.select(self.card.did);print('PLACES: deck selected',flush=True)
   mw.moveToState('review');print('PLACES: entered reviewer',flush=True);QTimer.singleShot(1500,self.poll)
  except Exception as e:self.finish(False,str(e))
 def render(self,html):
  mw.web.stdHtml('<div id="qa" class="card">'+mw.prepare_card_text_for_display(html)+'</div>',context=mw.reviewer,default_css=False)
  self.polls=0;QTimer.singleShot(1500,self.poll)
 def poll(self):
  mw.web.evalWithCallback("({ready:!!document.querySelector('[data-ready=true]'),status:document.querySelector('.map-status')?.textContent})",self.ready)
 def ready(self,r):
  print("PLACES: ",self.side,r,flush=True)
  if not r or not r.get('ready'):
   self.polls+=1
   if self.polls>25:self.finish(False,str(r));return
   QTimer.singleShot(1500,self.poll);return
  if self.side=='front':
   mw.web.evalWithCallback("(()=>{const p=window.__places;p.setGuess([-100,40]);document.querySelector('.place-pin').click();p.map.jumpTo({center:[-100,40],zoom:2});document.querySelector('[data-action=settings]').click();let t=document.querySelector('[data-pref=tolerance]');t.value='80';t.dispatchEvent(new Event('change'));let b=document.querySelector('[data-pref=borders]');b.checked=true;b.dispatchEvent(new Event('change'));return {guess:!!p.attempt.guess,cleared:document.querySelectorAll('.place-pin').length===0,tolerance:p.tolerance(),borders:p.map.getLayoutProperty('borders','visibility')};})()",self.front)
  else:
   mw.web.evalWithCallback("(()=>{document.querySelectorAll('.thumbnails button')[1].click();document.querySelector('[data-hero]').click();return {guess:!!window.__places.attempt.guess,implicit:window.__places.attempt.implicit,overlay:document.querySelector('.result').closest('.globe-wrap')!==null,tolerance:window.__places.tolerance(),hero:document.querySelector('[data-hero]').alt,pins:document.querySelectorAll('.place-pin').length,line:!!window.__places.map.getLayer('comparison-line'),viewer:!!document.querySelector('.agv'),result:document.querySelector('.result').textContent};})()",self.back)
 def front(self,r):
  self.checks.append(dict(front=r));assert not r['guess'] and r['cleared'] and r['tolerance']==80 and r['borders']=='visible'
  self.side='back';mw.reviewer._showAnswer();QTimer.singleShot(2000,self.poll)
 def back(self,r):
  self.checks.append(dict(back=r));mw.web.grab().save('/tmp/places-native-interaction.png')
  self.finish(bool(r['guess'] and r['implicit'] and r['overlay'] and r['tolerance']==80 and r['viewer'] and r['pins']==2 and r['line'] and r['hero']=='Second gallery sample'),str(r))
def start():
 global started
 if started:return
 started=True
 p=Probe();p.start();mw._places_probe=p

gui_hooks.main_window_did_init.append(lambda:QTimer.singleShot(1000,start))
QTimer.singleShot(3000,start)
