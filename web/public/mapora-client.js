/** Mapora JavaScript client. Keep secret API keys on your server. */
export class Mapora {
 constructor({apiKey,baseURL="https://api.mapora.dev"}){this.apiKey=apiKey;this.baseURL=baseURL.replace(/\/$/,"");}
 async request(path,{method="GET",body,signal}={}){const response=await fetch(this.baseURL+path,{method,signal,credentials:"omit",headers:{"X-API-Key":this.apiKey,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await response.json();}catch{throw new Error("Invalid Mapora response");}if(!response.ok){const error=new Error(data.error||"Mapora request failed");error.status=response.status;error.code=data.code;error.retryAfter=Number(response.headers.get("Retry-After"))||0;throw error;}return data;}
 search(q,params={},signal){return this.request("/v1/search?"+new URLSearchParams({...params,q}),{signal});}
 autocomplete(q,params={},signal){return this.request("/v1/autocomplete?"+new URLSearchParams({...params,q}),{signal});}
 geocode(params,signal){return this.request("/v1/geocode?"+new URLSearchParams(params),{signal});}
 reverse(latitude,longitude,signal){return this.request("/v1/reverse?"+new URLSearchParams({lat:latitude,lng:longitude}),{signal});}
 nearby(params,signal){return this.request("/v1/nearby?"+new URLSearchParams(params),{signal});}
 resolve(url,includeAddress=true){return this.request("/v1/resolve",{method:"POST",body:{url,includeAddress}});}
 routes(locations,profile="driving"){return this.request("/v1/routes",{method:"POST",body:{locations,profile}});}
 matrix(sources,targets,profile="driving"){return this.request("/v1/matrix",{method:"POST",body:{sources,targets,profile}});}
 batch(items,signal){return this.request("/v1/batch",{method:"POST",body:{items},signal});}
 coverage(point,zones){return this.request("/v1/coverage",{method:"POST",body:{point,zones}});}
 checkCoverage(point,zoneIds){return this.request("/v1/coverage/check",{method:"POST",body:{point,zoneIds}});}
 map(spec){return this.request("/v1/maps",{method:"POST",body:spec});}
}
