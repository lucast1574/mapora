import React, { useMemo, useRef, useState } from "react";
import { Compass, Download, MapPin, Plus, X, ArrowUpRight } from "lucide-react";
import { Button, Notice, Select } from "../ui";
import AddressSearch, { geoRequest } from "../location/AddressSearch";
import MapCanvas from "../maps/MapCanvas";
import "../location/workspace.css";
import "./intelligence.css";
const initial = { latitude: -12.1199, longitude: -77.029 };
const tools = [
 { value: "places", label: "Buscar lugares", description: "Explora negocios y servicios cerca de un punto. Abre una ficha o descarga una página en CSV." },
 { value: "isochrones", label: "Alcance por tiempo", description: "Visualiza hasta dónde puedes llegar en 5, 10 y 15 minutos por las calles disponibles." },
 { value: "optimize", label: "Ordenar paradas", description: "Mantén el origen y el destino y calcula un orden para las paradas intermedias." },
 { value: "along-route", label: "Lugares durante una ruta", description: "Encuentra una parada por su tiempo adicional de desvío, con estimaciones sin tráfico en vivo." },
 { value: "area", label: "Lugares en un polígono", description: "Consulta un área GeoJSON, incluidos sus huecos, y recorre sus páginas de resultados." },
 { value: "match", label: "Ajustar recorrido GPS", description: "Relaciona observaciones GPS con la red vial. Conserva siempre el recorrido original." },
];
const categories = [{ value: "", label: "Todas las categorías" }, ...[["amenity:pharmacy", "Farmacias"],["amenity:restaurant", "Restaurantes"],["amenity:fuel", "Gasolineras"],["shop:supermarket", "Supermercados"],["shop:bakery", "Panaderías"],["amenity:veterinary", "Veterinarias"],["amenity:cafe", "Cafeterías"],["tourism:hotel", "Hoteles"],["amenity:hospital", "Hospitales"],["amenity:parking", "Estacionamientos"]].map(([value,label])=>({value,label}))];
const polygon = { type: "Polygon", coordinates: [[[-77.04,-12.13],[-77.02,-12.13],[-77.02,-12.11],[-77.04,-12.11],[-77.04,-12.13]]] };
function cleanPoint(p) { return { latitude: p.latitude, longitude: p.longitude }; }
function download(csv) { const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); const a=document.createElement("a"); a.href=url;a.download="mapora-places.csv";a.click();URL.revokeObjectURL(url); }
export default function Intelligence() {
 const [key,setKey]=useState(""), [mode,setMode]=useState("places"), [center,setCenter]=useState(initial), [profile,setProfile]=useState("walking"), [category,setCategory]=useState("amenity:pharmacy"), [query,setQuery]=useState(""), [radius,setRadius]=useState(3000), [stops,setStops]=useState([null,null]), [trace,setTrace]=useState(JSON.stringify([initial,{latitude:-12.1225,longitude:-77.0305},{latitude:-12.125,longitude:-77.032}],null,2)), [area,setArea]=useState(JSON.stringify(polygon,null,2)), [result,setResult]=useState(null), [detail,setDetail]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState("");
 const stopKeys=useRef([0,1]), nextStopKey=useRef(2);
 const tool=tools.find(t=>t.value===mode);
 function invalidate() {setResult(null);setDetail(null);setError("");}
 const spec=useMemo(()=>({center,zoom:14,theme:"light",markers:result?.results?.length?result.results:mode==="optimize"?stops.filter(Boolean):[center],route:result?.geometry?.type==="LineString"?result.geometry:undefined,shapes:result?.geometry?.features?.filter(f=>["Polygon","MultiPolygon"].includes(f.geometry?.type)).map(f=>f.geometry)||[]}),[center,result,stops,mode]);
 function params(offset=0) { return new URLSearchParams({lat:center.latitude,lng:center.longitude,radius,limit:20,offset,...(category?{category}:{}),...(query.trim()?{q:query.trim()}: {})}); }
 async function run(e,offset=0) {
  e?.preventDefault(); if(busy)return;setBusy(true);setError("");setDetail(null);setResult(null);
  try {
   let path,body;
   if(mode==="places")path="/v1/places?"+params(offset);
   else if(mode==="isochrones") {path="/v1/isochrones";body={center:cleanPoint(center),minutes:[5,10,15],profile};}
   else if(mode==="match") {path="/v1/match";body={locations:JSON.parse(trace),profile};}
   else if(mode==="area") {path="/v1/places/area";body={geometry:JSON.parse(area),...(category?{category}:{}),...(query.trim()?{q:query.trim()}:{}),limit:20,offset};}
   else {const points=stops.map(p=>p&&cleanPoint(p));if(points.some(p=>!p))throw new Error("Selecciona una sugerencia para cada parada.");path=mode==="optimize"?"/v1/routes/optimize":"/v1/places/along-route";body={locations:points,profile,...(mode==="along-route"?{category,corridorMeters:1000,maxDetourSeconds:600,limit:10}:{})};}
   setResult(await geoRequest("",key.trim(),path,body));
  } catch(e){setError(e instanceof SyntaxError?"Revisa el formato JSON de las coordenadas.":e.message);}finally{setBusy(false);}
 }
 async function exportCSV() {setBusy(true);setError("");try{const res=await fetch("/v1/places/export?"+params(),{credentials:"omit",headers:{"X-API-Key":key.trim()}});if(!res.ok){const data=await res.json();throw new Error(data.error||"No se pudo exportar.");}download(await res.text());}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function inspect(p) {setBusy(true);setError("");try{const d=await geoRequest("",key.trim(),"/v1/places/details?"+new URLSearchParams({id:p.id}));setDetail(d.place);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <>
  <div className="page-title"><div><h1>Lugares y recorridos.</h1><p>Decide dónde ir, qué queda en el camino y hasta dónde puedes llegar.</p></div><Compass size={28} aria-hidden="true" /></div>
  <div className="geo-toolbar"><label>API key privada<input type="password" autoComplete="off" value={key} disabled={busy} onChange={e=>{setKey(e.target.value);invalidate();}} placeholder="mp_live_…" /></label><label>Herramienta<Select label="Herramienta geográfica" value={mode} disabled={busy} onChange={v=>{setMode(v);stopKeys.current=[nextStopKey.current++,nextStopKey.current++];setStops([null,null]);if(v==="along-route"&&!category)setCategory("amenity:fuel");invalidate();}} options={tools} /></label><label>Perfil<Select label="Perfil de viaje" value={profile} disabled={busy} onChange={v=>{setProfile(v);invalidate();}} options={[{value:"walking",label:"A pie"},{value:"driving",label:"Automóvil"},{value:"cycling",label:"Bicicleta"}]} /></label></div>
  <Notice error>{error}</Notice><p className="geo-hint">{tool.description} Las consultas usan la cuota de tu cuenta. Catálogo: permiso places; alcance, paradas y GPS: routing. Para buscar direcciones añade search.</p>
  <div className="geo-workbench geo-routing-workbench"><form className="geo-form" onSubmit={run}>
   {["places","isochrones"].includes(mode)&&<><AddressSearch apiKey={key} disabled={busy} label="Buscar punto de referencia" onSelect={p=>{setCenter(cleanPoint(p));invalidate();}} bias={center} /><p className="geo-hint"><MapPin size={14} /> También puedes elegir el centro pulsando el mapa. {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}</p></>}
   {["places","area","along-route"].includes(mode)&&<label>Categoría<Select label="Categoría del lugar" value={category} onChange={v=>{setCategory(v);invalidate();}} disabled={busy} options={mode==="along-route"?categories.filter(c=>c.value):categories} /></label>}
   {["places","area"].includes(mode)&&<label>Nombre opcional<input value={query} maxLength={200} disabled={busy} onChange={e=>{setQuery(e.target.value);invalidate();}} placeholder="Nombre del negocio o servicio" /></label>}
   {mode==="places"&&<label>Radio en metros<input type="number" min="50" max="50000" required value={radius} disabled={busy} onChange={e=>{setRadius(e.target.value);invalidate();}} /></label>}
   {["optimize","along-route"].includes(mode)&&<>{stops.map((p,i)=><div className="intelligence-stop" key={stopKeys.current[i]}><AddressSearch apiKey={key} disabled={busy} label={i===0?"Origen":i===stops.length-1?"Destino":`Parada ${i}`} bias={center} onQueryChange={()=>{setStops(xs=>xs.map((x,j)=>j===i?null:x));invalidate();}} onSelect={p=>{setStops(xs=>xs.map((x,j)=>j===i?p:x));invalidate();}} />{p&&<small>{p.placeName}</small>}</div>)}{mode==="optimize"&&stops.length<10&&<Button type="button" variant="secondary" disabled={busy} onClick={()=>{stopKeys.current=[...stopKeys.current.slice(0,-1),nextStopKey.current++,stopKeys.current.at(-1)];setStops(xs=>[...xs.slice(0,-1),null,xs.at(-1)]);invalidate();}}><Plus size={15}/>Añadir parada</Button>}</>}
   {mode==="match"&&<label>Observaciones GPS<textarea rows={12} value={trace} disabled={busy} spellCheck={false} onChange={e=>{setTrace(e.target.value);invalidate();}} /><small>JSON: lista de latitude y longitude, en orden. De 2 a 2000 puntos; hasta 200 km.</small></label>}
   {mode==="area"&&<label>Área GeoJSON<textarea rows={12} value={area} disabled={busy} spellCheck={false} onChange={e=>{setArea(e.target.value);invalidate();}} /><small>Polygon con coordenadas [longitud, latitud]. Hasta 200 vértices y cuatro huecos.</small></label>}
   <Button busy={busy} disabled={!key.trim()}>Consultar {tool.label.toLowerCase()}</Button>
   {mode==="places"&&<Button type="button" variant="secondary" disabled={busy||!key.trim()} onClick={exportCSV}><Download size={16}/>Exportar primera página CSV</Button>}
  </form><div className="geo-preview"><MapCanvas spec={spec} onSelect={["places","isochrones"].includes(mode)?p=>{setCenter(p);invalidate();}:undefined} showSelectionMarker={["places","isochrones"].includes(mode)}/></div></div>
  {result&&<section className="intelligence-results" aria-live="polite"><h2>{result.results?`${result.count} lugares en esta página`:"Recorrido calculado"}</h2>{result.candidateSearchTruncated&&<p className="geo-hint">La búsqueda evaluó una selección limitada de candidatos. Puede haber otros lugares en la zona.</p>}{result.results?.length===0&&<p>No se encontraron lugares en esta página. Prueba otra categoría o continúa si hay más páginas.</p>}{result.results?.map(p=><article className="intelligence-place" key={p.id}><div><h3>{p.placeName}</h3><p>{p.address||p.category}</p><small>{p.detourSeconds!=null?`${Math.ceil(p.detourSeconds/60)} min adicionales de desvío`:p.distanceMeters!=null?`${Math.round(p.distanceMeters)} m de distancia en línea recta`:p.category}</small></div><Button variant="secondary" disabled={busy} onClick={()=>inspect(p)}>Ver ficha <ArrowUpRight size={15}/></Button></article>)}{result.hasMore&&<Button variant="secondary" disabled={busy} onClick={()=>run(null,result.nextOffset)}>Siguiente página</Button>}{result.waypointOrder&&<p>Orden de las paradas originales: {result.waypointOrder.map(i=>i+1).join(", ")}. Distancia: {Math.round(result.distanceMeters)} m. Tiempo estimado: {Math.ceil(result.durationSeconds/60)} min.</p>}<details><summary>Ver respuesta JSON</summary><pre className="geo-json">{JSON.stringify(result,null,2)}</pre></details></section>}
  {detail&&<aside className="intelligence-detail"><button className="icon-button" aria-label="Cerrar ficha" onClick={()=>setDetail(null)}><X size={18}/></button><h2>{detail.placeName}</h2><dl>{[["Dirección",detail.address],["Categoría",detail.category],["Teléfono",detail.phone],["Web",detail.website],["Horario OSM",detail.openingHours],["Accesibilidad",detail.wheelchair],["Fuente actualizada",detail.sourceUpdatedAt]].filter(([,v])=>v).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><p>Datos de OpenStreetMap, según disponibilidad. El horario es el texto de la fuente; no confirma que esté abierto ahora. Las coordenadas pueden ser una referencia del edificio.</p></aside>}
  <p className="geo-hint">Catálogo, rutas y tiempos en América, según datos disponibles. Sin tráfico en vivo ni reseñas de Google. © OpenStreetMap contributors.</p>
 </>;
}
