import importlib.util,json,sqlite3,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('catalog',Path(__file__).with_name('catalog.py'))
catalog=importlib.util.module_from_spec(spec);spec.loader.exec_module(catalog)
class CatalogTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
  self.db.create_function('distance',4,catalog.distance)
  self.db.executescript("CREATE TABLE places(id INTEGER PRIMARY KEY,osm_id,name,normalized,category,latitude,longitude,city,country,data); CREATE VIRTUAL TABLE spatial USING rtree(id,minlat,maxlat,minlon,maxlon); CREATE VIRTUAL TABLE names USING fts5(normalized,content='places',content_rowid='id'); CREATE TABLE metadata(key,value); INSERT INTO metadata VALUES('builtAt','\"test\"');")
  for i,name,lat,lon in [(1,'Farmácia Central',-12.12,-77.03),(2,'Farmacia Lejana',-12.14,-77.03),(3,'Across dateline',0,-179.999)]:
   data={'id':f'osm:N:{i}','placeName':name,'latitude':lat,'longitude':lon}
   self.db.execute('INSERT INTO places VALUES(?,?,?,?,?,?,?,?,?,?)',(i,data['id'],name,catalog.normalize(name),'amenity:pharmacy',lat,lon,'lima','PE',json.dumps(data)))
   self.db.execute('INSERT INTO spatial VALUES(?,?,?,?,?)',(i,lat,lat,lon,lon))
  self.db.execute("INSERT INTO names(names) VALUES('rebuild')")
 def tearDown(self):self.db.close()
 def test_radius_exact_distance_and_pagination(self):
  out=catalog.search(self.db,{'lat':-12.12,'lng':-77.03,'radius':500,'category':'amenity:pharmacy'})
  self.assertEqual([p['id'] for p in out['results']],['osm:N:1'])
  out=catalog.search(self.db,{'q':'farmacia','limit':1})
  self.assertTrue(out['hasMore']);self.assertEqual(out['nextOffset'],1)
  self.assertEqual(catalog.search(self.db,{'q':'farmacia','limit':1,'offset':1})['results'][0]['id'],'osm:N:2')
 def test_antimeridian_radius_and_fts_escaping(self):
  self.assertEqual(catalog.search(self.db,{'lat':0,'lng':179.999,'radius':500})['count'],1)
  self.assertEqual(catalog.search(self.db,{'q':'"farmacia" OR *'})['count'],0)
 def test_missing_area_and_invalid_bounds(self):
  for p in [{},{'bbox':'NaN,0,1,1'},{'q':'x','limit':1001},{'lat':0,'lng':0,'radius':'NaN'}]:
   with self.assertRaises(ValueError):catalog.search(self.db,p)
if __name__=='__main__':unittest.main()
