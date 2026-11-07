import pathlib,urllib.request,hashlib,json,concurrent.futures,urllib.parse,time
import argparse
parser=argparse.ArgumentParser(description='Download the pinned public inputs for the offline Peru street index.')
parser.add_argument('--cache',type=pathlib.Path,required=True)
root=parser.parse_args().cache;root.mkdir(parents=True,exist_ok=True)
jobs=[('https://download.geofabrik.de/south-america/peru-261105.osm.pbf','peru-261105.osm.pbf'),('https://download.geofabrik.de/south-america/peru-261105.osm.pbf.md5','peru-261105.osm.pbf.md5')]
for layer,name in [('ig_distrito','districts'),('ig_provincia','provinces'),('ig_departamento','departments')]:
 jobs.append(('https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows?'+urllib.parse.urlencode({'service':'WFS','version':'1.0.0','request':'GetFeature','typeName':'Interoperabilidad:'+layer,'outputFormat':'application/json','srsName':'EPSG:4326'}),name+'.geojson'))
for url,name in [('https://munitrujillo.gob.pe/Archivosvirtual/plandet/AREA_URBANA_SECTOR_20.pdf','trujillo-sector20.pdf'),('https://munitrujillo.gob.pe/Archivosvirtual/plandet/AREA%20URBANA%20SECTOR%2008.pdf','trujillo-sector08.pdf'),('https://munitrujillo.gob.pe/Archivosvirtual/plandet/AREA%20URBANA%20SECTOR%2006.pdf','trujillo-sector06.pdf')]:jobs.append((url,name))
def get(job):
 url,name=job;p=root/name
 if p.exists():return name+' already present'
 n=0;start=time.monotonic()
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mapora-street-index/1.0 (hola@nexode.app)'})
  with urllib.request.urlopen(req,timeout=40) as r,p.with_suffix(p.suffix+'.partial').open('wb') as f:
   while b:=r.read(1024*1024):f.write(b);n+=len(b)
  p.with_suffix(p.suffix+'.partial').replace(p)
  return f'{name} {n} bytes {time.monotonic()-start:.1f}s'
 except Exception as e:return name+' FAILED '+str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
 for v in ex.map(get,jobs):print(v,flush=True)
p=root/'peru-261105.osm.pbf';expected=(root/'peru-261105.osm.pbf.md5').read_text().split()[0];assert hashlib.file_digest(p.open('rb'),'md5').hexdigest()==expected;print('PERU_SOURCE_CHECKSUM_VERIFIED',flush=True)
