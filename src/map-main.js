import 'maplibre-gl/dist/maplibre-gl.css';
import './map-style.css';
import maplibregl from 'maplibre-gl';
import { Geolocation } from '@capacitor/geolocation';
import {navigationZoom, smoothHeading, formatSpeed, tripDistanceMeters} from './navigation-utils.mjs';

const $ = id => document.getElementById(id);
document.getElementById('app').innerHTML = `
<div class="shell">
  <header><div class="brand"><span class="mark">◈</span><div><b>NAVIGATOR</b><small>GLOBAL ROUTING / PROTOTYPE</small></div></div><button id="theme" class="iconbtn" title="Cambiar tema">☼</button></header>
  <aside class="panel"><a href="./index.html" class="back-link">← VOLVER A AGENDA</a>
    <div class="eyebrow">PLANIFICA TU RECORRIDO</div><h1>El mundo,<br><em>una ruta.</em></h1>
    <label for="origin">ORIGEN</label><div class="field"><input id="origin" placeholder="Latitud, longitud o usa GPS" value="9.9281, -84.0907"><button id="gps" title="Mi ubicación">◎</button></div>
    <label for="destination">DESTINO</label><div class="field"><input id="destination" placeholder="Busca una ciudad o dirección" autocomplete="off"></div>
    <div id="suggestions" class="suggestions" hidden></div>
    <div class="actions"><button id="route" class="primary">CALCULAR RUTA <span>↗</span></button><button id="clear" class="secondary">LIMPIAR</button></div>
    <div class="toggles"><button id="buildings" class="toggle active" aria-pressed="true">▥ EDIFICIOS 3D</button><button id="follow" class="toggle active" aria-pressed="true">⌖ SEGUIR</button><button id="voice" class="toggle" aria-pressed="false">♫ VOZ</button></div><button id="preview3d" class="secondary full" type="button">◈ VER PERSPECTIVA 3D</button><div id="status" role="status" aria-live="polite">Introduce un destino para comenzar.</div>
    <div id="result" hidden><div class="metrics"><div><strong id="duration">—</strong><span>TIEMPO ESTIMADO</span></div><div><strong id="distance">—</strong><span>DISTANCIA</span></div></div><div class="routehead">INDICACIONES <span id="stepcount"></span></div><ol id="steps"></ol><button id="start" class="secondary full">INICIAR NAVEGACIÓN GPS</button><p class="hint">Navegación en primer plano. Recalcula si detecta una desviación persistente.</p></div>
    <div class="footnote">Prototipo experimental · Servicios públicos de demostración, sin SLA ni tráfico en vivo.</div>
  </aside>
  <main id="map" aria-label="Mapa interactivo"></main><button id="driveCTA" class="drive-cta" type="button">▶ INICIAR VIAJE · CÁMARA 3D</button>
  <div id="drivingHUD" class="driving-hud" hidden><div class="hud-top"><span id="hudNext">Sigue la ruta</span><button id="hudExit" aria-label="Salir de modo conducción">✕</button></div><div class="hud-bottom"><div><strong id="hudSpeed">0</strong><small>km/h</small></div><div><strong id="hudRemaining">—</strong><small>restantes</small></div><div><strong id="hudETA">—</strong><small>ETA estimada</small></div><button id="hudRecenter" aria-label="Volver a seguir GPS">⌖</button></div><div id="hudNotice" class="hud-notice">GPS en primer plano · Conduce con atención</div></div>
  <div class="mapcontrols"><button id="locate" title="Centrar en mi ubicación">⌖</button><button id="zoomIn" title="Acercar">+</button><button id="zoomOut" title="Alejar">−</button></div>
  <div class="mapcredit">© OpenStreetMap contributors · OpenFreeMap</div>
</div>`;
const state = {driving:false, wakeLock:null, tripStart:null, tripMeters:0, previousFix:null, lastHeading:null, lastCameraUpdate:0, activeBooking:null, origin: [ -84.0907,9.9281 ], destination:null, marker:null, originMarker:null, tracking:null, watchId:null, route:null, follow:true, buildings:true, voice:false, rerouting:false, deviationCount:0, lastReroute:0, lastInstruction:-1, currentLocation:null};
const setStatus=(msg,error=false)=>{ $('status').textContent=msg; $('status').classList.toggle('error',error); };
const map = new maplibregl.Map({
 container:'map', style: 'https://tiles.openfreemap.org/styles/liberty',
 center:state.origin, zoom:11, attributionControl:true
});
map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'bottom-right');
const originMarker = new maplibregl.Marker({color:'#a78bfa'}).setLngLat(state.origin).addTo(map);
const preferences=Object.assign({pitch:62,adaptive:true,voice:true,buildings:true,reroute:true,keepAwake:true},JSON.parse(localStorage.getItem('navigator-driving-prefs')||'{}'));
state.voice=preferences.voice;state.buildings=preferences.buildings;
const config = { deviationMeters: 75, deviationFixes: 3, rerouteCooldownMs: 18000 };
function toggleButton(id,enabled){const b=$(id);b.classList.toggle('active',enabled);b.setAttribute('aria-pressed',String(enabled));}
function enableBuildings(){
 if(!map.isStyleLoaded() || map.getLayer('navigator-buildings'))return;
 const style=map.getStyle();
 const vector=Object.entries(style.sources||{}).find(([,v])=>v.type==='vector');
 if(!vector){setStatus('El estilo de mapa no contiene datos vectoriales de edificios.',true);return;}
 const layer={id:'navigator-buildings',type:'fill-extrusion',source:vector[0],
 'source-layer':'building',minzoom:14,
 paint:{'fill-extrusion-color':['interpolate',['linear'],['zoom'],14,'#a7a0b8',17,'#a99bd0'],
 'fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,15,['coalesce',['get','render_height'],['get','height'],12]],
 'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],
 'fill-extrusion-opacity':0.78}};
 try{map.addLayer(layer);}catch(e){console.warn('Capa de edificios no disponible',e);}
}
map.on('load',()=>{if(state.buildings)enableBuildings();});
toggleButton('voice',state.voice);toggleButton('buildings',state.buildings);
$('buildings').onclick=()=>{
 state.buildings=!state.buildings;toggleButton('buildings',state.buildings);
 if(state.buildings)enableBuildings();else if(map.getLayer('navigator-buildings'))map.removeLayer('navigator-buildings');
 map.easeTo({pitch:state.buildings?55:0,duration:700});
};
$('follow').onclick=()=>{state.follow=!state.follow;toggleButton('follow',state.follow);};
$('voice').onclick=()=>{state.voice=!state.voice;toggleButton('voice',state.voice);
 if(state.voice)speak('Indicaciones por voz activadas');else if('speechSynthesis' in window)window.speechSynthesis.cancel();};
function speak(text){if(!state.voice||!('speechSynthesis' in window))return;
 try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='es-ES';u.rate=1;window.speechSynthesis.speak(u);}catch(e){console.warn('Voz no disponible',e);}}
function distanceMeters(a,b){const lat=(a[1]+b[1])*Math.PI/360;
 return Math.hypot((a[0]-b[0])*111320*Math.cos(lat),(a[1]-b[1])*111320);}
function segmentDistance(p,a,b){const latitude=p[1]*Math.PI/180;const sx=111320*Math.cos(latitude),sy=111320;
 const ax=(a[0]-p[0])*sx,ay=(a[1]-p[1])*sy,bx=(b[0]-p[0])*sx,by=(b[1]-p[1])*sy;
 const vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy;
 const t=den?Math.max(0,Math.min(1,-(ax*vx+ay*vy)/den)):0;
 return Math.hypot(ax+t*vx,ay+t*vy);}
function routeDistance(p,coords){if(!coords||coords.length<2)return Infinity;
 let best=Infinity;for(let i=1;i<coords.length;i++)best=Math.min(best,segmentDistance(p,coords[i-1],coords[i]));return best;}
function navigatePosition(pos){
 const coords=[pos.coords.longitude,pos.coords.latitude];state.currentLocation=coords;
 if(!state.tracking)state.tracking=new maplibregl.Marker({color:'#34d399'}).setLngLat(coords).addTo(map);
 else state.tracking.setLngLat(coords);
 const speed=Number.isFinite(pos.coords.speed)?Math.max(0,pos.coords.speed):0;
 const accuracy=pos.coords.accuracy||100;
 if(state.driving){
  $('hudSpeed').textContent=formatSpeed(speed);
  if(state.previousFix&&accuracy<=55&&state.previousFix.accuracy<=55){
   const d=distanceMeters(coords,state.previousFix.coords);
   if(d<Math.max(30, speed*6+20))state.tripMeters+=d;
  }
  if(accuracy<=55)state.previousFix={coords,accuracy};
  if(state.route){
   const meters=routeDistance(coords,state.route.geometry.coordinates);
   const next=state.route.legs.flatMap(l=>l.steps).find(step=>distanceMeters(coords,step.maneuver.location)<400);
   $('hudNext').textContent=next?instruction(next):'Sigue la ruta indicada';
   $('hudRemaining').textContent=Number.isFinite(meters)?Math.round(meters)+' m':'—';
   $('hudETA').textContent=state.route.duration?Math.max(1,Math.round(state.route.duration/60))+' min':'—';
  }
 }
 if(state.follow && (!state.driving || Date.now()-state.lastCameraUpdate>900)){
  const bearing=smoothHeading(state.lastHeading,pos.coords.heading,speed);
  if(bearing!==null)state.lastHeading=bearing;
  const center=coords;
  map.easeTo({center,zoom:state.driving?(preferences.adaptive?navigationZoom(speed):16):Math.max(map.getZoom(),15),
   pitch:state.driving?preferences.pitch:(state.buildings?55:0),
   bearing:state.driving?(bearing??map.getBearing()):(Number.isFinite(pos.coords.heading)&&speed>1.5?pos.coords.heading:map.getBearing()),
   padding:state.driving?{top:110,bottom:Math.round(window.innerHeight*.34),left:0,right:0}:{top:0,bottom:0,left:0,right:0},duration:900});
  state.lastCameraUpdate=Date.now();
 }
 if(!state.route)return;
 const dist=routeDistance(coords,state.route.geometry.coordinates);
 if(accuracy>90)return;
 if(dist>Math.max(config.deviationMeters,accuracy*1.8))state.deviationCount++;else state.deviationCount=0;
 if(preferences.reroute&&state.deviationCount>=config.deviationFixes&&!state.rerouting&&Date.now()-state.lastReroute>config.rerouteCooldownMs){
  state.deviationCount=0;state.rerouting=true;state.lastReroute=Date.now();
  state.origin=coords;originMarker.setLngLat(coords);
  $('origin').value=`${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
  setStatus('Desviación detectada. Recalculando ruta…');speak('Recalculando ruta');
  calculateRoute().finally(()=>{state.rerouting=false;});
 }
 const steps=state.route.legs.flatMap(l=>l.steps);
 // Announce the nearest upcoming maneuver; avoid repeating the same instruction.
 let closest=-1,nearest=Infinity;
 steps.forEach((step,i)=>{const d=distanceMeters(coords,step.maneuver.location);if(d<nearest){nearest=d;closest=i;}});
 if(closest>=0&&nearest<110&&closest!==state.lastInstruction){state.lastInstruction=closest;speak(instruction(steps[closest]));}
}
function setDestination(coords,label) {
 state.destination=coords;
 $('destination').value=label;
 if(state.marker) state.marker.remove();
 state.marker=new maplibregl.Marker({color:'#ff6b65'}).setLngLat(coords).addTo(map);
 $('suggestions').hidden=true;
 map.flyTo({center:coords,zoom:12});
}
function parseCoordinates(s){
 const m=s.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
 if(!m)return null;
 const lat=Number(m[1]),lon=Number(m[2]);
 return Math.abs(lat)<=90&&Math.abs(lon)<=180?[lon,lat]:null;
}
$('origin').addEventListener('change',()=>{
 const p=parseCoordinates($('origin').value);
 if(!p){setStatus('El origen debe ser «latitud, longitud» o usa GPS.',true);return;}
 state.origin=p;originMarker.setLngLat(p);
});
$('destination').addEventListener('change',()=>{
 const p=parseCoordinates($('destination').value);
 if(p)setDestination(p,$('destination').value);
});
let searchTimer, searchController;
$('destination').addEventListener('input',()=>{
 state.destination=null;
 clearTimeout(searchTimer);
 if(searchController)searchController.abort();
 const q=$('destination').value.trim();
 const box=$('suggestions');
 if(q.length<3||parseCoordinates(q)){box.hidden=true;return;}
 searchTimer=setTimeout(async()=>{
  searchController=new AbortController();
  try{
   const r=await fetch('https://photon.komoot.io/api/?limit=5&q='+encodeURIComponent(q),{signal:searchController.signal});
   if(!r.ok)throw Error('Búsqueda no disponible');
   const data=await r.json();
   box.replaceChildren();
   for(const f of data.features||[]){
    const p=f.properties||{};
    const label=[p.name,p.city,p.state,p.country].filter(Boolean).join(', ');
    const b=document.createElement('button');b.textContent=label||'Ubicación';
    b.onclick=()=>setDestination(f.geometry.coordinates,label);
    box.appendChild(b);
   }
   box.hidden=!box.children.length;
  }catch(e){if(e.name!=='AbortError')setStatus('Búsqueda no disponible. Usa coordenadas.',true);}
 },450);
});
async function locate(){
 try{
  setStatus('Obteniendo ubicación…');
  const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000});
  const coords=[p.coords.longitude,p.coords.latitude];
  state.origin=coords;originMarker.setLngLat(coords);
  $('origin').value=`${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
  map.flyTo({center:coords,zoom:15});
  setStatus('Ubicación actualizada.');
 }catch(e){setStatus('No se pudo obtener GPS. Revisa los permisos y HTTPS.',true);}
}
$('gps').onclick=locate;$('locate').onclick=locate;
$('zoomIn').onclick=()=>map.zoomIn();$('zoomOut').onclick=()=>map.zoomOut();
function renderRoute(coords){
 const source=map.getSource('route');
 const feature={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}};
 if(source)source.setData(feature);
 else {
  map.addSource('route',{type:'geojson',data:feature});
  map.addLayer({id:'route-outline',type:'line',source:'route',paint:{'line-color':'#111827','line-width':9,'line-opacity':.85},layout:{'line-join':'round','line-cap':'round'}});
  map.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#a78bfa','line-width':5},layout:{'line-join':'round','line-cap':'round'}});
 }
 const bounds=coords.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0]));
 map.fitBounds(bounds,{padding:85,maxZoom:15,duration:900});
}
function instruction(step){
 const t=step.maneuver?.type||'continue',m=step.maneuver?.modifier||'';
 const names={depart:'Salir',arrive:'Llegada al destino',turn:'Girar',continue:'Continuar',merge:'Incorporarse',fork:'Tomar bifurcación','on ramp':'Tomar acceso','off ramp':'Tomar salida',roundabout:'Entrar en rotonda','end of road':'Fin de vía','new name':'Continuar'};
 const dirs={left:'a la izquierda',right:'a la derecha','slight left':'ligeramente a la izquierda','slight right':'ligeramente a la derecha',straight:'recto',uturn:'en U'};
 return `${names[t]||'Continuar'}${dirs[m]?' '+dirs[m]:''}${step.name?' · '+step.name:''}`;
}
async function calculateRoute(){
 const p=parseCoordinates($('origin').value);
 if(!p){setStatus('Origen inválido: usa latitud, longitud.',true);return;}
 state.origin=p;originMarker.setLngLat(p);
 if(!state.destination){
  const d=parseCoordinates($('destination').value);
  if(d)setDestination(d,$('destination').value);
 }
 if(!state.destination){setStatus('Selecciona un destino de la lista o introduce coordenadas.',true);return;}
 $('route').disabled=true;setStatus('Calculando la mejor ruta disponible…');
 try{
  const pair=[state.origin,state.destination].map(p=>p.join(',')).join(';');
  const url=`https://router.project-osrm.org/route/v1/driving/${pair}?overview=full&geometries=geojson&steps=true`;
  const r=await fetch(url);if(!r.ok)throw Error(`HTTP ${r.status}`);
  const data=await r.json();
  if(data.code!=='Ok'||!data.routes?.length)throw Error(data.message||'No existe una ruta');
  const route=data.routes[0];state.route=route;state.lastInstruction=-1;
  const coords=route.geometry.coordinates;
  if(map.isStyleLoaded())renderRoute(coords);
  else map.once('load',()=>renderRoute(coords));
  $('duration').textContent=route.duration>=3600?`${Math.floor(route.duration/3600)} h ${Math.round(route.duration%3600/60)} min`:`${Math.round(route.duration/60)} min`;
  $('distance').textContent=route.distance>=1000?`${(route.distance/1000).toFixed(1)} km`:`${Math.round(route.distance)} m`;
  const steps=route.legs.flatMap(l=>l.steps);
  $('steps').replaceChildren();
  steps.forEach(step=>{
   const li=document.createElement('li');
   const name=document.createElement('span');name.textContent=instruction(step);
   const dist=document.createElement('small');dist.textContent=step.distance>=1000?`${(step.distance/1000).toFixed(1)} km`:`${Math.round(step.distance)} m`;
   li.append(name,dist);$('steps').appendChild(li);
  });
  $('stepcount').textContent=`${steps.length} PASOS`;
  $('result').hidden=false;setStatus('Ruta calculada. Tiempos estimados, sin tráfico en vivo.');
 }catch(e){setStatus('No se pudo calcular la ruta: '+e.message,true);}
 finally{$('route').disabled=false;}
}
$('route').onclick=calculateRoute;
$('preview3d').onclick=()=>{map.easeTo({pitch:62,zoom:Math.max(16,map.getZoom()),duration:1200});setStatus('Vista 3D activada. Para seguir al conductor, inicia el viaje y concede GPS.');};
async function updateOriginFromGPS(){
 const permission=await Geolocation.requestPermissions();
 if(!['granted','limited'].includes(permission.location))throw Error('Permiso GPS denegado');
 const pos=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:20000});
 const coords=[pos.coords.longitude,pos.coords.latitude];
 state.origin=coords;state.currentLocation=coords;originMarker.setLngLat(coords);
 $('origin').value=`${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
 map.easeTo({center:coords,zoom:16,pitch:62,duration:900});
 return pos;
}
$('driveCTA').onclick=async()=>{
 if(state.driving)return;
 if(!state.destination){setStatus('Primero selecciona un destino. Puedes buscarlo o introducir coordenadas.',true);document.querySelector('.panel').scrollIntoView({behavior:'smooth'});return;}
 const btn=$('driveCTA');btn.disabled=true;btn.textContent='PREPARANDO GPS Y RUTA…';
 try{
  await updateOriginFromGPS();
  await calculateRoute();
  if(!state.route)throw Error('No se pudo calcular la ruta. Comprueba Internet y el destino.');
  await $('start').click();
  if(!state.driving)throw Error('No se inició el seguimiento GPS. Revisa los permisos de ubicación.');
 }catch(e){setStatus('No se pudo iniciar: '+e.message,true);}
 finally{btn.disabled=false;btn.textContent='▶ INICIAR VIAJE · CÁMARA 3D';}
};
$('clear').onclick=()=>{
 state.destination=null;state.route=null;$('destination').value='';$('result').hidden=true;
 if(state.marker){state.marker.remove();state.marker=null;}
 if(map.getLayer('route-line'))map.removeLayer('route-line');
 if(map.getLayer('route-outline'))map.removeLayer('route-outline');
 if(map.getSource('route'))map.removeSource('route');
 setStatus('Ruta borrada.');
};
async function releaseWakeLock(){try{await state.wakeLock?.release();}catch{}state.wakeLock=null;}
async function acquireWakeLock(){if(!preferences.keepAwake||!('wakeLock' in navigator))return;try{state.wakeLock=await navigator.wakeLock.request('screen');}catch(e){console.warn('Pantalla activa no disponible',e);}}
function stopDriving(){
 state.driving=false;$('drivingHUD').hidden=true;document.body.classList.remove('driving');
 map.easeTo({pitch:0,padding:{top:0,bottom:0,left:0,right:0},duration:700});
 releaseWakeLock();
 if(state.tripStart){
  const log=JSON.parse(localStorage.getItem('navigator-trip-history')||'[]');
  log.unshift({start:state.tripStart,end:new Date().toISOString(),distanceMeters:Math.round(state.tripMeters),destination:$('destination').value,bookingId:state.activeBooking});
  localStorage.setItem('navigator-trip-history',JSON.stringify(log.slice(0,100)));
 }
 state.tripStart=null;state.tripMeters=0;state.previousFix=null;
}
function startDriving(){
 state.driving=true;state.follow=true;state.lastHeading=null;map.easeTo({center:state.currentLocation||state.origin,pitch:preferences.pitch,zoom:17,duration:1000});state.tripStart=new Date().toISOString();state.tripMeters=0;
 toggleButton('follow',true);$('drivingHUD').hidden=false;document.body.classList.add('driving');
 $('hudNext').textContent='Sigue la ruta';$('hudRemaining').textContent=state.route?`${(state.route.distance/1000).toFixed(1)} km`:'—';
 $('hudETA').textContent=state.route?`${Math.round(state.route.duration/60)} min`:'—';
 acquireWakeLock();map.resize();
}
$('hudRecenter').onclick=()=>{state.follow=true;toggleButton('follow',true);};
$('hudExit').onclick=()=>{$('start').click();};
map.on('dragstart',()=>{if(state.driving){state.follow=false;toggleButton('follow',false);}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.driving)acquireWakeLock();});
$('start').onclick=async()=>{
 if(state.watchId!==null){
  try{await Geolocation.clearWatch({id:state.watchId});}catch(e){console.warn(e);}
  state.watchId=null;stopDriving();$('start').textContent='INICIAR NAVEGACIÓN GPS';setStatus('Navegación GPS detenida.');return;
 }
 if(!state.route){setStatus('Calcula una ruta antes de iniciar la navegación.',true);return;}
 try{
  const permission=await Geolocation.requestPermissions();
  if(!['granted','limited'].includes(permission.location))throw Error('Permiso de ubicación denegado');
  state.watchId=await Geolocation.watchPosition({enableHighAccuracy:true,timeout:15000,maximumAge:1000},(pos,err)=>{
   if(err){setStatus('GPS: '+err.message,true);return;}
   if(pos)navigatePosition(pos);
  });
  startDriving();$('start').textContent='DETENER NAVEGACIÓN GPS';
  setStatus('Navegación activa en primer plano. La precisión depende del GPS.');
  speak('Navegación iniciada');
 }catch(e){setStatus('No se pudo iniciar el GPS: '+e.message,true);}
};
$('theme').onclick=()=>document.body.classList.toggle('light');
async function preloadBooking(){
 const params=new URLSearchParams(location.search);
 const destination=params.get('destination');state.activeBooking=params.get('booking');
 if(!destination)return;
 $('destination').value=destination;
 const parsed=parseCoordinates(destination);
 if(parsed){setDestination(parsed,destination);return;}
 try{
  const r=await fetch('https://photon.komoot.io/api/?limit=1&q='+encodeURIComponent(destination));
  if(!r.ok)throw Error('Búsqueda fallida');
  const data=await r.json();const first=data.features?.[0];
  if(first){setDestination(first.geometry.coordinates,destination);setStatus('Destino de la reserva cargado. Pulsa INICIAR VIAJE para activar GPS, ruta y cámara 3D.');}
  else setStatus('Destino no encontrado. Busca una dirección o introduce coordenadas.',true);
 }catch{setStatus('No se pudo ubicar el destino. Introduce coordenadas o busca manualmente.',true);}
}
preloadBooking();
