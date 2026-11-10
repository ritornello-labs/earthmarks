"""Reproject NASA's global plate-carree mosaic into shared local Mercator tiles.
Run with the Workbench Python environment, which already supplies Pillow.
"""
from pathlib import Path
from PIL import Image
import math,json,hashlib
R=Path(__file__).resolve().parents[2];O=R/'out/places';D=O/'media';D.mkdir(exist_ok=True)
Image.MAX_IMAGE_PIXELS=300_000_000
source=O/'world-nasa.jpg';metadata=json.loads((R/'places/data/offline-source.json').read_text());assert hashlib.sha256(source.read_bytes()).hexdigest()==metadata['sha256'],'Offline source digest mismatch';im=Image.open(source);im.draft('RGB',(10800,5400));im=im.convert('RGB');w,h=im.size
S=1024;MAX=4;names=[]
for z in range(MAX+1):
 n=2**z
 for x in range(n):
  for y in range(n):
   mesh=[]
   for row in range(0,S,16):
    bottom=min(row+16,S)
    def sy(r):return (90-math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+r/S)/n)))))/180*h
    left=x/n*w;right=(x+1)/n*w;top=sy(row);bot=sy(bottom)
    mesh.append(((0,row,S,bottom),(left,top,left,bot,right,bot,right,top)))
   tile=im.transform((S,S),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)
   name=f'_places_earth_v1_{z}_{x}_{y}.jpg';tile.save(D/name,quality=83,optimize=True);names.append(name)
 manifest=dict(source='https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x21600x10800.jpg',sha256=hashlib.sha256(source.read_bytes()).hexdigest(),tile_size=S,maxzoom=MAX,files=names,bytes=sum((D/p).stat().st_size for p in names))
 (O/'offline-manifest.json').write_text(json.dumps(manifest,indent=2))
 print('Completed level',z,flush=True)
print('Media bytes',manifest['bytes'],'files',len(names))
