"""Build an offline, replaceable OSM node/way POI catalog; never modify the active DB."""
import json, os, shutil, sqlite3, sys, time, unicodedata
from pathlib import Path
import osmium

KEYS = ('amenity', 'shop', 'tourism', 'office', 'leisure', 'healthcare', 'craft')
def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(c))

def main():
    source, output = map(Path, sys.argv[1:3])
    if output.exists():
        raise SystemExit('Refusing to overwrite existing staging catalog')
    db = sqlite3.connect(output)
    db.executescript('''PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-65536;
    CREATE TABLE places(id INTEGER PRIMARY KEY, osm_id TEXT UNIQUE, name TEXT, normalized TEXT, category TEXT, latitude REAL, longitude REAL, city TEXT, country TEXT, data TEXT);
    CREATE VIRTUAL TABLE spatial USING rtree(id,minlat,maxlat,minlon,maxlon);
    CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);
    ''')
    started = time.time()
    class Importer(osmium.SimpleHandler):
        count = 0
        def save(self, obj, kind, lat, lon):
            tags = dict(obj.tags)
            key = next((k for k in KEYS if tags.get(k)), None)
            if not key or not (-90 <= lat <= 90 and -180 <= lon <= 180): return
            category = key + ':' + tags[key]
            name = tags.get('name') or tags.get('brand') or tags.get('operator') or tags[key].replace('_', ' ')
            address = ', '.join(filter(None, [' '.join(filter(None, [tags.get('addr:street'), tags.get('addr:housenumber')])), tags.get('addr:city'), tags.get('addr:state'), tags.get('addr:country')]))
            data = {'id': f'osm:{kind}:{obj.id}', 'placeName': name, 'category': category, 'latitude': lat, 'longitude': lon, 'address': address, 'city': tags.get('addr:city',''), 'countryCode': tags.get('addr:country','').upper(), 'source':'openstreetmap', 'attribution':'© OpenStreetMap contributors', 'coordinateType':'osm_node' if kind == 'N' else 'way_reference', 'sourceUpdatedAt': str(obj.timestamp), 'verified':False}
            for dest, sources in {'phone':('contact:phone','phone'), 'website':('contact:website','website'), 'email':('contact:email','email'), 'openingHours':('opening_hours',), 'wheelchair':('wheelchair',), 'cuisine':('cuisine',), 'brand':('brand',), 'operator':('operator',)}.items():
                val=next((tags[k] for k in sources if tags.get(k)),None)
                if val: data[dest]=val[:2000]
            cur=db.execute('INSERT INTO places(osm_id,name,normalized,category,latitude,longitude,city,country,data) VALUES(?,?,?,?,?,?,?,?,?)',(data['id'],name,normalize(name),category,lat,lon,normalize(data['city']),data['countryCode'],json.dumps(data,ensure_ascii=False)))
            db.execute('INSERT INTO spatial VALUES(?,?,?,?,?)',(cur.lastrowid,lat,lat,lon,lon))
            self.count += 1
            if self.count % 50000 == 0:
                db.commit()
                print(json.dumps({'places':self.count,'elapsedSeconds':round(time.time()-started),'freeGB':round(shutil.disk_usage(output.parent).free/1e9,1)}),flush=True)
                if shutil.disk_usage(output.parent).free < 80 * 1024**3: raise RuntimeError('Less than 80 GiB free; active catalog unchanged')
        def node(self,n):
            if any(k in n.tags for k in KEYS) and n.location.valid(): self.save(n,'N',n.location.lat,n.location.lon)
        def way(self,w):
            if not any(k in w.tags for k in KEYS): return
            coords=[(n.lat,n.lon) for n in w.nodes if n.location.valid()]
            if not coords:return
            # Bounding-box midpoint is a reference, never an entrance guarantee.
            self.save(w,'W',(min(p[0] for p in coords)+max(p[0] for p in coords))/2,(min(p[1] for p in coords)+max(p[1] for p in coords))/2)
    handler=Importer()
    cache=str(output)+'.nodes'
    try: handler.apply_file(str(source), locations=True, idx='sparse_file_array,'+cache)
    finally:
        if os.path.exists(cache): os.unlink(cache)
    db.commit()
    print('Building search indexes',flush=True)
    db.executescript("CREATE INDEX category_idx ON places(category); CREATE INDEX country_idx ON places(country); CREATE VIRTUAL TABLE names USING fts5(normalized,content='places',content_rowid='id',tokenize='unicode61'); INSERT INTO names(names) VALUES('rebuild');")
    for key,val in {'records':handler.count,'builtAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sourceFile':source.name,'coverage':os.environ.get('PLACES_COVERAGE','americas'),'objectTypes':['node','way']}.items():
        db.execute('INSERT INTO metadata VALUES(?,?)',(key,json.dumps(val)))
    db.commit()
    if db.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise RuntimeError('Catalog integrity check failed')
    db.close()
    print(json.dumps({'complete':True,'records':handler.count,'output':str(output),'bytes':output.stat().st_size}),flush=True)
if __name__=='__main__': main()
