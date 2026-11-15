"""Private, read-only OSM catalog. Spatial/FTS queries have bounded execution time."""
import json, math, os, re, sqlite3, time, unicodedata
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB=os.environ.get('PLACES_DB','/data/places.sqlite')

def normalize(v):
    return ''.join(c for c in unicodedata.normalize('NFKD',v.casefold()) if not unicodedata.combining(c))
def distance(a,b,c,d):
    rad=math.pi/180
    h=math.sin((c-a)*rad/2)**2+math.cos(a*rad)*math.cos(c*rad)*math.sin((d-b)*rad/2)**2
    return 12742000*math.atan2(math.sqrt(max(0,h)),math.sqrt(max(0,1-h)))
def connect():
    db=sqlite3.connect('file:'+DB+'?mode=ro',uri=True,timeout=2)
    db.row_factory=sqlite3.Row
    deadline=time.monotonic()+4
    db.set_progress_handler(lambda: int(time.monotonic()>deadline),10000)
    db.create_function('distance',4,distance,deterministic=True)
    return db

def search(db,p):
    where=[];args=[];join=''; sort='p.id'; fields='p.data'; area=False
    def one(k,default=''):return str(p.get(k,default))
    limit=int(one('limit','20')); offset=int(one('offset','0'))
    if not 1<=limit<=1000 or not 0<=offset<=1000000:raise ValueError('Invalid pagination')
    if one('lat') or one('lng'):
        lat=float(one('lat'));lon=float(one('lng'));radius=float(one('radius','5000'))
        if not all(map(math.isfinite,[lat,lon,radius])) or not -90<=lat<=90 or not -180<=lon<=180 or not 50<=radius<=50000:raise ValueError('Invalid radius or coordinates')
        dy=radius/110574;dx=min(180,radius/(111320*max(.001,math.cos(math.radians(lat)))))
        west,east=lon-dx,lon+dx
        longitude='s.maxlon>=? AND s.minlon<=?'
        longargs=[west,east]
        if west < -180:longitude='(s.maxlon>=? OR s.minlon<=?)';longargs=[west+360,east]
        if east > 180:longitude='(s.maxlon>=? OR s.minlon<=?)';longargs=[west,east-360]
        where += ['s.maxlat>=? AND s.minlat<=? AND '+longitude]
        args += [max(-90,lat-dy),min(90,lat+dy),*longargs]
        # Exact great-circle distance filters the rectangular preselection.
        where += ['distance(?,?,p.latitude,p.longitude)<=?'];args += [lat,lon,radius]
        fields += ',distance('+repr(lat)+','+repr(lon)+',p.latitude,p.longitude) AS distance_m'
        sort='distance_m,p.id';area=True
    if one('bbox'):
        nums=list(map(float,one('bbox').split(',')))
        if len(nums)!=4 or not all(map(math.isfinite,nums)):raise ValueError('Invalid bbox')
        west,south,east,north=nums
        if not (-180<=west<east<=180 and -90<=south<north<=90):raise ValueError('Invalid bbox')
        where += ['s.maxlon>=? AND s.minlon<=? AND s.maxlat>=? AND s.minlat<=? AND p.longitude>=? AND p.longitude<=? AND p.latitude>=? AND p.latitude<=?'];args += [west,east,south,north,west,east,south,north];area=True
    if area:join+=' JOIN spatial s ON s.id=p.id'
    q=one('q').strip()
    if q:
        tokens=re.findall(r'\w+',normalize(q),re.UNICODE)[:12]
        if not tokens:raise ValueError('Query needs letters or numbers')
        join+=' JOIN names ON names.rowid=p.id';where+=['names MATCH ?'];args+=[' AND '.join('"'+t+'"*' for t in tokens)]
    if not area and not q:raise ValueError('Provide q, bbox or coordinates')
    category=one('category')
    if category:
        if not re.fullmatch(r'(amenity|shop|tourism|office|leisure|healthcare|craft):[a-z0-9_]{1,80}',category):raise ValueError('Invalid category')
        where+=['p.category=?'];args += [category]
    if one('countrycodes'):
        codes=one('countrycodes').upper().split(',')
        if len(codes)>10 or any(not re.fullmatch('[A-Z]{2}',c) for c in codes):raise ValueError('Invalid countrycodes')
        where += ['p.country IN ('+','.join('?' for _ in codes)+')'];args+=codes
    if one('city'):
        where+=['p.city=?'];args += [normalize(one('city'))]
    rows=db.execute('SELECT '+fields+' FROM places p'+join+' WHERE '+' AND '.join(where)+' ORDER BY '+sort+' LIMIT ? OFFSET ?',args+[limit+1,offset]).fetchall()
    results=[]
    for row in rows[:limit]:
        data=json.loads(row['data'])
        if 'distance_m' in row.keys():data['distanceMeters']=round(row['distance_m'])
        results.append(data)
    meta={row['key']:json.loads(row['value']) for row in db.execute('SELECT * FROM metadata')}
    return {'results':results,'count':len(results),'hasMore':len(rows)>limit,'nextOffset':offset+limit if len(rows)>limit else None,'dataset':meta,'attribution':'© OpenStreetMap contributors','distanceType':'straight_line' if one('lat') else None}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        path=urlparse(self.path);params={k:v[0] for k,v in parse_qs(path.query).items()}
        code=200
        try:
            with closing(connect()) as db:
                if path.path=='/status':data={'status':'operational','dataset':{r['key']:json.loads(r['value']) for r in db.execute('SELECT * FROM metadata')}}
                elif path.path=='/search':data=search(db,params)
                elif path.path=='/details':
                    row=db.execute('SELECT data FROM places WHERE osm_id=?',(params.get('id',''),)).fetchone()
                    if not row:code=404;data={'error':'Place not found'}
                    else:data={'place':json.loads(row[0]),'attribution':'© OpenStreetMap contributors'}
                else:code=404;data={'error':'Not found'}
        except ValueError as e:code=400;data={'error':str(e)}
        except (sqlite3.Error,OSError):code=503;data={'error':'Catalog unavailable or query exceeded its time budget'}
        body=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
if __name__=='__main__':ThreadingHTTPServer(('0.0.0.0',8090),Handler).serve_forever()
