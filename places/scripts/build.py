"""Build standalone preview, Anki templates and optional synthetic QA APKG."""
from pathlib import Path
import base64,json,re,argparse,subprocess
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'out'/'places';OUT.mkdir(parents=True,exist_ok=True)
FIELDS=['Name','Coordinates','Type','Context','Images','Wikipedia URL','Extra','Tolerance km']
def script(s):return '<script>eval(new TextDecoder().decode(Uint8Array.from(atob("'+base64.b64encode(s.encode()).decode()+'"),c=>c.charCodeAt(0))));</script>'
def build():
    countries=json.loads((ROOT/'places/data/countries.geojson').read_text())
    borders={'type':'FeatureCollection','features':[{'type':'Feature','properties':{},'geometry':f['geometry']} for f in countries['features']]}
    css=(ROOT/'node_modules/maplibre-gl/dist/maplibre-gl.css').read_text()+'\n'+(ROOT/'places/src/card.css').read_text()
    subprocess.run([str(ROOT/'node_modules/.bin/esbuild'),str(ROOT/'node_modules/maplibre-gl/dist/maplibre-gl.mjs'),'--bundle','--format=iife','--global-name=maplibregl','--minify','--outfile='+str(OUT/'maplibre.js')],check=True)
    subprocess.run([str(ROOT/'node_modules/.bin/esbuild'),str(ROOT/'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'),'--bundle','--format=iife','--minify','--outfile='+str(OUT/'worker.js')],check=True)
    runtime=(OUT/'maplibre.js').read_text()+';window.maplibregl=maplibregl;maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([new TextDecoder().decode(Uint8Array.from(atob("'+base64.b64encode((OUT/'worker.js').read_bytes()).decode()+'"),c=>c.charCodeAt(0)))],{type:"text/javascript"})));'
    # Reuse a single library instance; each card releases its own map/worker resources.
    library=runtime+'\nwindow.PLACES_BORDERS='+json.dumps(borders,separators=(',',':'))+';'
    cached_library=script(library).replace('<script>','<script>if(!window.maplibregl){',1).replace('</script>','}</script>')
    engine=(ROOT/'places/src/places.js').read_text()
    gallery=(ROOT/'places/src/gallery-viewer.js').read_text()
    templates={}
    for side in ['front','back']:
        markup=(ROOT/'places/src/card.html').read_text().replace('SIDE',side).replace('BACK_CONTENT',(ROOT/'places/src/back.html').read_text() if side=='back' else '')
        templates[side]=markup+cached_library+script(engine)+(script(gallery) if side=='back' else '')
        (OUT/(side+'.html')).write_text(templates[side])
    (OUT/'card.css').write_text(css)
    (OUT/'model.json').write_text(json.dumps(dict(modelName='Places — Globe',fields=FIELDS,css=css,cardTemplates=[dict(Name='Locate',Front=templates['front'],Back=templates['back'])])))
    return templates,css

def render(template,fields):
    # Deliberately small Mustache renderer for synthetic harness only; native Anki renders the APKG.
    template=re.sub(r'{{([#^])([^}]+)}}(.*?){{/\2}}',lambda m:m[3] if bool(fields.get(m[2],''))==(m[1]=='#') else '',template,flags=re.S)
    return re.sub(r'{{([^}]+)}}',lambda m:fields.get(m[1],''),template)

def preview(t,css):
    samples=[['San Francisco','37.7775, -122.416389','City','California, USA'],['Mount Everest','27.9881, 86.9250','Mountain','Himalayas'],['Angkor Wat','13.4125, 103.8670','Temple','Cambodia']]
    fixtures=[]
    for name,coords,kind,ctx in samples:
        f=dict.fromkeys(FIELDS,'');f.update({'Name':name,'Coordinates':coords,'Type':kind,'Context':ctx,'Extra':'A point on a shared globe. Images and article are optional.'})
        svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#184950"/><circle cx="400" cy="200" r="120" fill="#78e4c8"/></svg>'
        f['Images']='<img alt="Synthetic gallery sample" src="data:image/svg+xml;base64,'+base64.b64encode(svg.encode()).decode()+'"><img alt="Second gallery sample" src="data:image/svg+xml;base64,'+base64.b64encode(svg.replace('#78e4c8','#ffb86b').encode()).decode()+'">'
        fixtures.append(f)
    harness='''<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Places · Globe preview</title><style>'''+css+'''</style><body class="card"><div id="qa"></div><div style="padding:16px;text-align:center"><select id="sample">'''+''.join('<option value="'+str(i)+'">'+f['Name']+'</option>' for i,f in enumerate(fixtures))+'''</select> <button id="reveal">Reveal answer</button> <button id="next">New attempt</button></div><script>const fixtures='''+json.dumps(fixtures)+''',templates='''+json.dumps(t).replace('<','\\u003c')+r''';let side='front';function draw(){let f=fixtures[+document.querySelector('#sample').value];let s=templates[side].replace(/\{\{([#^])([^}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,(_,op,k,body)=>Boolean(f[k])===(op==='#')?body:'').replace(/\{\{([^}]+)\}\}/g,(_,k)=>f[k]||'');const qa=document.querySelector('#qa');qa.innerHTML=s;for(const old of qa.querySelectorAll('script')){const s=document.createElement('script');s.textContent=old.textContent;old.replaceWith(s)}}document.querySelector('#reveal').onclick=()=>{side='back';draw()};document.querySelector('#next').onclick=()=>{side='front';draw()};document.querySelector('#sample').onchange=()=>{side='front';draw()};draw();</script></body></html>'''
    (OUT/'preview.html').write_text(harness)
    return fixtures
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--apkg',action='store_true');args=p.parse_args();t,css=build();fixtures=preview(t,css)
    if args.apkg:
        import genanki
        m=genanki.Model(1836193301,'Places — Globe QA',fields=[{'name':f} for f in FIELDS],templates=[{'name':'Locate','qfmt':t['front'],'afmt':t['back']}],css=css)
        deck=genanki.Deck(1836193302,'Places Preview')
        for f in fixtures:deck.add_note(genanki.Note(model=m,fields=[f[k] for k in FIELDS],guid=genanki.guid_for('places-preview',f['Name'])))
        package=genanki.Package(deck);package.media_files=[str(f) for f in (OUT/'media').glob('_places_earth_v1_*.jpg')];package.write_to_file(str(OUT/'preview.apkg'))
    print(OUT)
