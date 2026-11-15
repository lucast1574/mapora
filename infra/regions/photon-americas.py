"""Filter a staging clone of Mapora's own Photon index; live index stays readable."""
import json,subprocess,time,os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT=Path('/var/lib/mapora-next/regions');ROOT.mkdir(exist_ok=True)
name=next(n for n in subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines() if n.startswith('mapora-photon_photon.'))
def call(method,path,data=None,timeout=300):
 cmd=['docker','exec',name,'curl','-fsS','--max-time',str(timeout),'-X',method,'-H','Content-Type: application/json']
 if data is not None:cmd+=['-d',json.dumps(data)]
 cmd+=['http://127.0.0.1:9201'+path]
 p=subprocess.run(cmd,capture_output=True,text=True)
 if p.returncode:raise RuntimeError(path+': '+p.stderr[:300])
 d=json.loads(p.stdout)
 if 'error' in d:raise RuntimeError(str(d['error'])[:300])
 return d
countries='AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GS GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI FR DK NL GB'.split()
def bbox(w,s,e,n):return {'geo_bounding_box':{'coordinate':{'top_left':{'lat':n,'lon':w},'bottom_right':{'lat':s,'lon':e}}}}
keep={'bool':{'filter':[{'terms':{'countrycode':countries}},{'bool':{'should':[bbox(-180,-60,-20,85),bbox(170,45,180,75),bbox(-75,58,-10,85)],'minimum_should_match':1}}]}}
remove={'bool':{'must_not':[keep]}}
(ROOT/'photon-americas-query.json').write_text(json.dumps(keep,indent=2)+'\n')
print('Counting Americas candidates',flush=True)
count=call('POST','/photon/_count',{'query':keep})['count'];print('Candidate count '+str(count),flush=True);total=call('GET','/photon/_stats/docs')['indices']['photon']['primaries']['docs']['count']
assert 10000000<count<total, (count,total)
print(json.dumps({'phase':'clone','keep':count,'remove':total-count}),flush=True)
exists=subprocess.run(['docker','exec',name,'curl','-s','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:9201/photon-americas-stage'],capture_output=True,text=True).stdout
if exists!='200':
 call('PUT','/photon/_settings',{'index':{'number_of_replicas':0,'blocks.write':True}})
 try:call('POST','/photon/_clone/photon-americas-stage',{'settings':{'index.number_of_replicas':0,'index.blocks.write':False}},timeout=180)
 finally:call('PUT','/photon/_settings',{'index':{'blocks.write':False}})
call('PUT','/photon-americas-stage/_settings',{'index':{'blocks.write':False,'refresh_interval':'-1'}})
call('GET','/_cluster/health/photon-americas-stage?wait_for_status=green&timeout=180s',timeout=190)
def delete_slice(slice_id):
 response=call('POST','/photon-americas-stage/_search?scroll=10m',{'query':remove,'slice':{'id':slice_id,'max':2},'size':10000,'_source':False,'sort':['_doc']})
 scroll=response.get('_scroll_id');deleted=0
 try:
  while True:
   hits=response.get('hits',{}).get('hits',[])
   if not hits:break
   bulk=''.join(json.dumps({'delete':{'_index':'photon-americas-stage','_id':h['_id']}})+'\n' for h in hits)
   command=['docker','exec','-i',name,'curl','-fsS','--max-time','300','-X','POST','-H','Content-Type: application/x-ndjson','--data-binary','@-','http://127.0.0.1:9201/_bulk?refresh=false']
   result=subprocess.run(command,input=bulk,capture_output=True,text=True)
   if result.returncode:raise RuntimeError(result.stderr[:300])
   data=json.loads(result.stdout)
   if data.get('errors'):raise RuntimeError('Bulk delete returned item errors')
   deleted+=len(hits)
   print(json.dumps({'phase':'filtering','slice':slice_id,'deleted':deleted}),flush=True)
   response=call('POST','/_search/scroll',{'scroll':'10m','scroll_id':scroll});scroll=response.get('_scroll_id',scroll)
 finally:
  if scroll:call('DELETE','/_search/scroll',{'scroll_id':[scroll]})
 return deleted
with ThreadPoolExecutor(max_workers=2) as pool:
 print('Removed documents '+str(sum(pool.map(delete_slice,[0,1]))),flush=True)
call('POST','/photon-americas-stage/_refresh')
remaining=call('POST','/photon-americas-stage/_count',{'query':remove})['count'];assert remaining==0,remaining
assert call('GET','/photon-americas-stage/_count')['count']==count
# Expunge deleted segments in the staging copy, with no production index writes.
call('PUT','/photon-americas-stage/_settings',{'index':{'blocks.write':True,'soft_deletes.retention_lease.period':'0ms'}})
response=call('POST','/photon-americas-stage/_forcemerge?only_expunge_deletes=true&wait_for_completion=false')
task=response.get('task')
if task:
 (ROOT/'photon-merge-task.txt').write_text(task)
 while True:
  d=call('GET','/_tasks/'+task)
  if d.get('completed'):
   if d.get('error') or d.get('response',{}).get('_shards',{}).get('failed'):raise RuntimeError(str(d)[:1500])
   break
  print(json.dumps({'phase':'merging'}),flush=True);time.sleep(30)
(ROOT/'photon-stage-ready.json').write_text(json.dumps({'index':'photon-americas-stage','records':count,'coverage':'americas','validatedOutsideCount':0})+'\n')
print('READY_FOR_ACTIVATION',flush=True)
