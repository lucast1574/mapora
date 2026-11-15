"""Complete the authorized region maintenance after independently validated staging jobs."""
import json,subprocess,time,os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT=Path('/var/lib/mapora-next/regions')
def report(job,state,**values):
 data={'job':job,'state':state,'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**values}
 p=ROOT/(job+'-activation.json');tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(data)+'\n');tmp.replace(p);print(json.dumps(data),flush=True)
def running(prefix):
 return next(n for n in subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines() if n.startswith(prefix))
def core(method,path,data=None):
 cmd=['docker','exec',running('mapora-photon_photon.'),'curl','-fsS','--max-time','300','-X',method,'-H','Content-Type: application/json']
 if data is not None:cmd+=['--data-binary','@-']
 cmd+=['http://127.0.0.1:9201'+path]
 p=subprocess.run(cmd,input=json.dumps(data) if data is not None else None,capture_output=True,text=True,check=True)
 return json.loads(p.stdout)
def source(path):
 p=subprocess.run(['docker','exec',running('mapora-photon_photon.'),'curl','-fsS','--max-time','30','http://127.0.0.1:2322'+path],capture_output=True,text=True,check=True)
 return json.loads(p.stdout)
def bbox(w,s,e,n):return {'geo_bounding_box':{'coordinate':{'top_left':{'lat':n,'lon':w},'bottom_right':{'lat':s,'lon':e}}}}
def strict_policy():
 broad=json.loads((ROOT/'photon-americas-query.json').read_text());codes=broad['bool']['filter'][0]['terms']['countrycode'];codes=[c for c in codes if c not in ['FR','DK','NL','GB']]
 branches=[{'bool':{'filter':[{'terms':{'countrycode':codes}},{'bool':{'should':[bbox(-180,-60,-20,85),bbox(170,45,180,75),bbox(-75,58,-10,85)],'minimum_should_match':1}}]}}]
 foreign={'FR':[bbox(-62,1,-48,19),bbox(-57,46,-55,48)],'DK':[bbox(-75,58,-10,85)],'NL':[bbox(-71,10,-62,19)],'GB':[bbox(-83,15,-59,33),bbox(-62,-59,-25,-50)]}
 for code,boxes in foreign.items():branches.append({'bool':{'filter':[{'term':{'countrycode':code}},{'bool':{'should':boxes,'minimum_should_match':1}}]}})
 return {'bool':{'should':branches,'minimum_should_match':1}}
def finish_photon():
 job='photon';report(job,'waiting_for_filtered_index')
 while not (ROOT/'photon-stage-ready.json').exists():
  pid=int((ROOT/'photon-filter.pid').read_text())
  stat=Path('/proc')/str(pid)/'stat'
  if not stat.exists() or stat.read_text().split()[2]=='Z':raise RuntimeError('Photon filtering stopped before readiness; inspect photon-filter.log')
  time.sleep(30)
 remove={'bool':{'must_not':[strict_policy()]}}
 outside=core('POST','/photon-americas-stage/_count',{'query':remove})['count']
 if outside:
  report(job,'removing_overseas_outliers',records=outside)
  core('PUT','/photon-americas-stage/_settings',{'index':{'blocks.write':False,'refresh_interval':'-1'}})
  r=core('POST','/photon-americas-stage/_search?scroll=10m',{'query':remove,'size':10000,'_source':False,'sort':['_doc']});scroll=r.get('_scroll_id')
  try:
   while r.get('hits',{}).get('hits'):
    bulk=''.join(json.dumps({'delete':{'_index':'photon-americas-stage','_id':h['_id']}})+'\n' for h in r['hits']['hits'])
    p=subprocess.run(['docker','exec','-i',running('mapora-photon_photon.'),'curl','-fsS','--max-time','300','-X','POST','-H','Content-Type: application/x-ndjson','--data-binary','@-','http://127.0.0.1:9201/_bulk?refresh=false'],input=bulk,text=True,capture_output=True,check=True)
    assert not json.loads(p.stdout).get('errors')
    r=core('POST','/_search/scroll',{'scroll':'10m','scroll_id':scroll});scroll=r.get('_scroll_id',scroll)
  finally:
   if scroll:core('DELETE','/_search/scroll',{'scroll_id':[scroll]})
  core('POST','/photon-americas-stage/_refresh');core('PUT','/photon-americas-stage/_settings',{'index':{'blocks.write':True}})
  core('POST','/photon-americas-stage/_forcemerge?only_expunge_deletes=true')
 assert core('POST','/photon-americas-stage/_count',{'query':remove})['count']==0
 count=core('GET','/photon-americas-stage/_count')['count'];assert count>10000000
 report(job,'activating_validated_index',records=count)
 core('PUT','/photon/_settings',{'index':{'blocks.write':True}})
 core('POST','/photon/_clone/photon-world-rollback',{'settings':{'index.number_of_replicas':0,'index.blocks.write':True}})
 core('GET','/_cluster/health/photon-world-rollback?wait_for_status=green&timeout=180s')
 core('DELETE','/photon')
 try:
  core('POST','/photon-americas-stage/_clone/photon',{'settings':{'index.number_of_replicas':0,'index.blocks.write':False,'index.refresh_interval':'1s'}})
  core('GET','/_cluster/health/photon?wait_for_status=green&timeout=180s')
  for country,q in [('PE','Miraflores'),('US','New+York'),('CA','Toronto'),('BR','Sao+Paulo'),('MX','Mexico')]:assert source('/api/?q='+q+'&countrycode='+country+'&limit=1').get('features'),country
  assert core('POST','/photon/_count',{'query':remove})['count']==0
 except Exception:
  core('DELETE','/photon');core('POST','/photon-world-rollback/_clone/photon',{'settings':{'index.number_of_replicas':0,'index.blocks.write':False,'index.refresh_interval':'1s'}})
  report(job,'activation_failed_original_restored');raise
 core('DELETE','/photon-world-rollback');core('DELETE','/photon-americas-stage')
 report(job,'complete',records=count,coverage='americas',outsideRecords=0)
def rootfs(script):
 subprocess.run(['docker','run','--rm','-i','-v','/var/lib/mapora-next:/data','python:3.13-slim','python','-'],input=script,text=True,check=True)
def finish_tiles():
 job='tiles';report(job,'waiting_for_regional_archive')
 while True:
  d=json.loads(subprocess.check_output(['docker','inspect','mapora-tiles-americas-extract','--format','{{json .State}}'],text=True))
  if not d['Running']:
   if d['ExitCode']!=0:raise RuntimeError('Tile extraction failed '+str(d))
   break
  time.sleep(30)
 image='192.168.15.8:5005/dokploy/mapora-pmtiles@sha256:67fae398a4381b4b12eec10db63b20d8693daf35fbeae83eff719458f567331d'
 subprocess.run(['docker','run','--rm','--cpus','2','--memory','12g','-v',str(ROOT)+':/data:ro',image,'verify','/data/americas.pmtiles'],check=True)
 report(job,'activating_validated_archive')
 rootfs("import os;src='/data/regions/americas.pmtiles';dst='/data/tiles/americas.pmtiles';assert os.path.getsize(src)>1000000;os.rename(src,dst);os.link('/data/tiles/world.pmtiles','/data/tiles/world-before-region.pmtiles');os.symlink('americas.pmtiles','/data/tiles/.world-next');os.replace('/data/tiles/.world-next','/data/tiles/world.pmtiles')")
 subprocess.run(['docker','restart','-t','10',running('mapora-tiles_engine.')],check=True)
 for _ in range(24):
  p=subprocess.run(['docker','exec',running('mapora-photon_photon.'),'curl','-fsS','--max-time','10','http://mapora-tiles_gateway:8081/world/0/0/0.mvt'],capture_output=True)
  if p.returncode==0:break
  time.sleep(5)
 else:
  rootfs("import os;os.replace('/data/tiles/world-before-region.pmtiles','/data/tiles/world.pmtiles')");subprocess.run(['docker','restart','-t','10',running('mapora-tiles_engine.')]);raise RuntimeError('Regional gateway did not become ready; restored original')
 rootfs("import os;os.unlink('/data/tiles/world-before-region.pmtiles')")
 report(job,'complete',coverage='americas',overviewContext='Low zoom tiles may contain shared global context')
def guarded(fn,job):
 try:fn()
 except Exception as e:report(job,'failed',error=str(e)[:600]);raise
if __name__=='__main__':
 if os.environ.get('MAPORA_ACTIVATE_REGION')!='1':raise SystemExit('Set MAPORA_ACTIVATE_REGION=1 only for the authorized regional maintenance')
 with ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(guarded,finish_photon,'photon'),pool.submit(guarded,finish_tiles,'tiles')]
  for f in futures:f.result()
