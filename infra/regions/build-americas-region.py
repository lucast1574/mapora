"""Regional tile mask from public-domain Natural Earth country geometry."""
import hashlib,json,urllib.request
from pathlib import Path
from shapely.geometry import shape,box,mapping
from shapely.ops import unary_union
url='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson'
raw=urllib.request.urlopen(url,timeout=60).read();data=json.loads(raw)
main=unary_union([box(-180,-60,-10,85),box(170,45,180,75)])
foreign=unary_union([box(-62,1,-48,19),box(-57,46,-55,48),box(-75,58,-10,85),box(-83,10,-59,33),box(-62,-59,-25,-50)])
parts=[]
for feature in data['features']:
 p=feature['properties'];g=shape(feature['geometry'])
 if p.get('CONTINENT') in ('North America','South America'):clipped=g.intersection(main)
 elif p.get('SOV_A3') in ('FR1','DN1','NL1','GB1','FRA','DNK','NLD','GBR'):clipped=g.intersection(foreign)
 else:continue
 if not clipped.is_empty:parts.append(clipped)
region=unary_union(parts).buffer(.12).intersection(main).simplify(.03,preserve_topology=True)
if region.geom_type=='Polygon':from shapely.geometry import MultiPolygon;region=MultiPolygon([region])
Path('infra/regions/americas.geojson').write_text(json.dumps(mapping(region),separators=(',',':'))+'\n')
Path('infra/regions/americas.manifest.json').write_text(json.dumps({'source':url,'sha256':hashlib.sha256(raw).hexdigest(),'license':'Natural Earth public domain','use':'Tile extraction mask only, not legal boundaries','bufferDegrees':.12,'simplifyDegrees':.03,'continents':['North America','South America']},indent=2)+'\n')
print('Americas polygons',len(region.geoms),'bytes',Path('infra/regions/americas.geojson').stat().st_size)
