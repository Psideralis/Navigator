// Navigator Android local demo: no HTTP requests or server dependencies.
const KEY='navigator_android_local_v1';
const HOURS=72*60*60*1000;
const driverSeeds=[
 {id:'d1',name:'Carlos M.',vehicle:'Sedán · 4 pasajeros',style:'Conducción suave',music:'Sin música',conversation:'Conversación opcional',score:97},
 {id:'d2',name:'Elena R.',vehicle:'SUV · 4 pasajeros',style:'Conducción preventiva',music:'Música suave',conversation:'Silencio preferido',score:99},
 {id:'d3',name:'Andrés V.',vehicle:'Eléctrico · 3 pasajeros',style:'Conducción tranquila',music:'A elección',conversation:'Conversación opcional',score:96}
];
export function seed(){return {drivers:driverSeeds,bookings:[],series:[],events:[]};}
export function loadDatabase(){
 try {const raw=localStorage.getItem(KEY);if(!raw)return seed();const db=JSON.parse(raw);if(!Array.isArray(db.drivers)||!Array.isArray(db.bookings)||!Array.isArray(db.series)||!Array.isArray(db.events))throw Error('Estructura inválida');return db;}
 catch(e){throw Error('No se pudo leer el almacenamiento del dispositivo. '+e.message);}
}
function save(db){try{localStorage.setItem(KEY,JSON.stringify(db));}catch(e){throw Error('No se pudieron guardar los datos locales. '+e.message);}}
function uid(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'local-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
export function expandDates(first,frequency,count){
 const d=new Date(first);if(!Number.isFinite(d.getTime()))throw Error('Fecha inválida');
 if(!['once','daily','weekly','weekdays'].includes(frequency))throw Error('Frecuencia inválida');
 if(!Number.isInteger(count)||count<1||count>30)throw Error('Cantidad fuera de rango (1–30)');
 const result=[];
 while(result.length<count){if(frequency!=='weekdays'||(d.getDay()!==0&&d.getDay()!==6))result.push(d.toISOString());if(frequency==='once')break;
 d.setDate(d.getDate()+(frequency==='weekly'?7:1));}
 return result;
}
export function overlaps(a,b,buffer=30){const x=new Date(a.start).getTime(),y=new Date(b.start).getTime();return x<y+(b.duration+buffer)*60000&&y<x+(a.duration+buffer)*60000;}
export function makeRequest(db,input,now=Date.now()){
 const {driverId,passengerName,origin,destination,start,duration,frequency='once',count=1,preferences=''}=input||{};
 if(!db.drivers.some(d=>d.id===driverId))throw Error('Conductor inexistente');
 if(typeof passengerName!=='string'||passengerName.trim().length<2||passengerName.length>80)throw Error('Nombre inválido');
 if(![origin,destination].every(v=>typeof v==='string'&&v.trim().length>=3&&v.length<=180))throw Error('Origen y destino requeridos');
 if(!Number.isInteger(duration)||duration<15||duration>480)throw Error('Duración entre 15 y 480 minutos');
 if(typeof preferences!=='string'||preferences.length>500)throw Error('Preferencias demasiado largas');
 const dates=expandDates(start,frequency,Number(count));
 if(dates.some(d=>new Date(d).getTime()-now<HOURS))throw Error('Cada viaje requiere al menos 72 horas de anticipación');
 const proposed=dates.map(d=>({start:d,duration}));
 if(proposed.some((p,i)=>proposed.slice(i+1).some(q=>overlaps(p,q))))throw Error('La serie contiene horarios incompatibles');
 const taken=db.bookings.filter(b=>b.driverId===driverId&&['pending','confirmed','in_progress'].includes(b.status));
 if(proposed.some(p=>taken.some(t=>overlaps(p,t))))throw Error('Conflicto con agenda existente (margen de 30 minutos)');
 const seriesId=frequency==='once'?null:uid();
 if(seriesId)db.series.push({id:seriesId,driverId,frequency,count,createdAt:new Date(now).toISOString()});
 const bookings=dates.map(date=>({id:uid(),seriesId,driverId,passengerName:passengerName.trim(),origin:origin.trim(),destination:destination.trim(),start:date,duration,preferences:preferences.trim(),status:'pending',createdAt:new Date(now).toISOString()}));
 db.bookings.push(...bookings);return bookings;
}
export function transition(db,id,action,driverId){
 const b=db.bookings.find(x=>x.id===id);if(!b)throw Error('Reserva inexistente');
 if(b.driverId!==driverId)throw Error('Conductor no autorizado en modo demostración');
 const transitions={pending:{accept:'confirmed',reject:'rejected'},confirmed:{start:'in_progress',cancel:'cancelled'},in_progress:{complete:'completed'}};
 const next=transitions[b.status]?.[action];if(!next)throw Error('Transición no permitida');
 if(action==='accept'&&db.bookings.some(t=>t.id!==b.id&&t.driverId===driverId&&['confirmed','in_progress'].includes(t.status)&&overlaps(t,b)))throw Error('Conflicto con reserva confirmada');
 b.status=next;db.events.push({id:uid(),bookingId:id,action,at:new Date().toISOString()});return b;
}
export async function localApi(path,options={}){
 const db=loadDatabase();
 if(!options.method||options.method==='GET'){
  if(path==='/drivers')return db.drivers;
  if(path==='/bookings')return db.bookings;
  if(path==='/series')return db.series;
  throw Error('Operación local desconocida');
 }
 if(options.method!=='POST')throw Error('Método no permitido');
 const body=JSON.parse(options.body||'{}');let result;
 if(path==='/bookings')result=makeRequest(db,body);
 else {const m=path.match(/^\/bookings\/([^/]+)\/action$/);if(!m)throw Error('Operación local desconocida');result=transition(db,m[1],body.action,body.driverId);}
 save(db);return result;
}
