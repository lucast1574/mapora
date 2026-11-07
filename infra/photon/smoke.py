import subprocess,json,urllib.parse,pathlib
base='http://mapora-photon_photon:2322'
def query(path,params=None):
 url=base+path+('?' + urllib.parse.urlencode(params) if params else '')
 result=subprocess.run(['docker','run','--rm','--network','dokploy-network','--entrypoint','curl','mapora-photon:1.3.0','--fail','--silent','--show-error','--max-time','20',url],capture_output=True,text=True,check=True)
 return json.loads(result.stdout)
status=query('/status');print('status',json.dumps(status,ensure_ascii=False),flush=True)
checks=[]
for city,country in [('Miraflores','PE'),('Bogota','CO'),('London','GB'),('Tokyo','JP')]:
 result=query('/api/',{'q':city,'countrycode':country,'limit':2});features=result.get('features',[]);assert features,(city,'empty result')
 assert all(f['properties'].get('countrycode','').upper()==country for f in features),(city,features)
 checks.append({'query':city,'country':country,'count':len(features),'place':features[0]['properties'].get('name'),'coordinates':features[0]['geometry']['coordinates']})
result=query('/reverse',{'lat':-12.119906,'lon':-77.028971,'limit':1});assert result.get('features');checks.append({'reverse':True,'place':result['features'][0]['properties'].get('name')})
pathlib.Path('/var/lib/mapora-photon/smoke-results.json').write_text(json.dumps({'status':status,'checks':checks},ensure_ascii=False,indent=2))
print(json.dumps({'privatePhotonChecks':checks},ensure_ascii=False),flush=True)
