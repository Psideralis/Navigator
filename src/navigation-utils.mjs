export function navigationZoom(speedMetersPerSecond){
 const kph=Math.max(0,Number(speedMetersPerSecond)||0)*3.6;
 if(kph<15)return 17.2;if(kph<40)return 16.5;if(kph<75)return 15.7;if(kph<105)return 15;return 14.3;
}
export function smoothHeading(previous,heading,speed){
 if(!Number.isFinite(heading)||heading<0||!Number.isFinite(speed)||speed<1.8)return previous;
 const target=((heading%360)+360)%360;
 if(previous===null||!Number.isFinite(previous))return target;
 const diff=((target-previous+540)%360)-180;
 return (previous+diff*.38+360)%360;
}
export function formatSpeed(speed){return String(Math.round(Math.max(0,Number(speed)||0)*3.6));}
export function tripDistanceMeters(points){let total=0;for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i],lat=(a[1]+b[1])*Math.PI/360;
 total+=Math.hypot((a[0]-b[0])*111320*Math.cos(lat),(a[1]-b[1])*111320);
}return total;}
