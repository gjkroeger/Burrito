const $ = id => document.getElementById(id);
const RADIUS_METERS = 16093.44;
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
let lastResults = [];

function distanceMeters(aLat,aLon,bLat,bLon){
  const rad = d => d*Math.PI/180;
  const dLat=rad(bLat-aLat), dLon=rad(bLon-aLon);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function mapsSearch(name,lat,lon){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=&center=${lat},${lon}`;}
function directions(lat,lon){return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function getJson(url){const r=await fetch(url,{headers:{"Accept":"application/json"}});if(!r.ok)throw new Error(`Request failed (${r.status})`);return r.json();}
async function geocode(query){
  const url=NOMINATIM+"?format=jsonv2&limit=1&q="+encodeURIComponent(query);
  const found=await getJson(url);
  if(!found.length)throw new Error("I couldn't find that location. Try a full address, city, or ZIP code.");
  return {lat:Number(found[0].lat),lon:Number(found[0].lon),label:found[0].display_name};
}
function queryFor(lat,lon,includeMexican){
  const around=`(around:${RADIUS_METERS},${lat},${lon})`;
  const parts=[
    `node${around}["amenity"~"restaurant|fast_food|cafe"]`,
    `way${around}["amenity"~"restaurant|fast_food|cafe"]`,
    `relation${around}["amenity"~"restaurant|fast_food|cafe"]`
  ];
  if(includeMexican){
    parts.push(`node${around}["cuisine"~"mexican|tex-mex|burrito|tacos",i]`);
    parts.push(`way${around}["cuisine"~"mexican|tex-mex|burrito|tacos",i]`);
    parts.push(`node${around}["name"~"burrito|taqueria|taco|mexican",i]`);
    parts.push(`way${around}["name"~"burrito|taqueria|taco|mexican",i]`);
  }else{
    parts.push(`node${around}["name"~"burrito",i]`);
    parts.push(`way${around}["name"~"burrito",i]`);
  }
  return `[out:json][timeout:35];(${parts.join(";")};);out center tags;`;
}
function mapTags(el){
  const t=el.tags||{};
  const lat=el.lat??el.center?.lat, lon=el.lon??el.center?.lon;
  if(lat==null||lon==null)return null;
  const name=t.name||t.brand||t.operator||"Unnamed restaurant";
  const searchable=[name,t.cuisine,t.description,t.amenity,t["food"]].filter(Boolean).join(" ").toLowerCase();
  const burritoMention=/burrito|mexican|tex.mex|taqueria|taco/.test(searchable);
  if(!burritoMention)return null;
  return {id:`${el.type}/${el.id}`,name,lat:Number(lat),lon:Number(lon),address:[t["addr:housenumber"],t["addr:street"],t["addr:city"]||t["addr:town"],t["addr:state"]].filter(Boolean).join(" ")||"Address not listed",cuisine:t.cuisine||"",website:t.website||t["contact:website"]||"",phone:t.phone||t["contact:phone"]||"",opening:t.opening_hours||"",amenity:t.amenity||"",tags:t};
}
function openNowApprox(hours){
  if(!hours)return null;
  // Opening-hours syntax is complex; do not falsely parse it.
  return null;
}
function makeCard(p){
  const menuQuery=encodeURIComponent(`${p.name} ${p.address} menu burrito`);
  const website=p.website && /^https?:\/\//i.test(p.website) ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">Website</a>` : "";
  const specialty=p.cuisine ? `Cuisine: ${esc(p.cuisine.replaceAll("; ",", "))}` : "Burrito offering not verified from a menu";
  const hours=p.opening ? `<span class="tag">Hours listed: ${esc(p.opening)}</span>` : "";
  return `<article class="place">
    <div class="place-top"><div class="pin">🌯</div><div style="min-width:0;flex:1"><h3>${esc(p.name)}</h3><p class="address">${esc(p.address)}</p></div><span class="distance">${p.miles.toFixed(1)} mi</span></div>
    <div class="tags"><span class="tag">${specialty}</span>${hours}<span class="tag">Open status not verified</span></div>
    <div class="actions"><a href="${directions(p.lat,p.lon)}" target="_blank" rel="noopener">Directions</a><a href="https://www.google.com/search?q=${menuQuery}" target="_blank" rel="noopener">Check menu</a>${website}</div>
  </article>`;
}
function render(){
  const sort=$("sort").value;
  let items=[...lastResults];
  if(sort==="name")items.sort((a,b)=>a.name.localeCompare(b.name));else items.sort((a,b)=>a.miles-b.miles);
  $("count").textContent=`${items.length} possible burrito spots within 10 miles`;
  $("results").innerHTML=items.length?items.map(makeCard).join(""):`<div class="empty">No likely matches found in the mapped data. Try another location or check Google Maps for additional restaurants.</div>`;
}
async function search(){
  const location=$("location").value.trim();
  if(!location){$("status").textContent="Enter an address, city, or ZIP code first.";return;}
  $("searchBtn").disabled=true;$("status").textContent="Finding your location and searching mapped restaurants…";$("results").innerHTML="";
  try{
    const center=await geocode(location);
    const query=queryFor(center.lat,center.lon,$("includeNearby").checked);
    let data=null, lastErr=null;
    for(const endpoint of OVERPASS){
      try{
        const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8","Accept":"application/json"},body:query});
        if(!response.ok)throw new Error(`Map search unavailable (${response.status})`);
        data=await response.json();break;
      }catch(e){lastErr=e;}
    }
    if(!data)throw lastErr||new Error("The map search service is temporarily unavailable.");
    const dedup=new Map();
    for(const el of data.elements||[]){
      const p=mapTags(el);if(!p)continue;
      const d=distanceMeters(center.lat,center.lon,p.lat,p.lon);
      if(d>RADIUS_METERS)continue;
      p.miles=d/1609.344;
      const key=(p.name+"|"+p.address).toLowerCase();
      if(!dedup.has(key)||p.address!=="Address not listed")dedup.set(key,p);
    }
    lastResults=[...dedup.values()];
    $("status").textContent=`Search centered on ${center.label}. Distances are straight-line estimates; results rely on OpenStreetMap coverage.`;
    render();
  }catch(e){
    $("status").textContent=e.message||"Something went wrong. Please try again.";
    $("results").innerHTML=`<div class="empty">Could not complete the search. Check your connection and try again. You can also <a href="https://www.google.com/maps/search/burrito+near+${encodeURIComponent(location)}/" target="_blank" rel="noopener">search Google Maps for burritos near this location</a>.</div>`;
  }finally{$("searchBtn").disabled=false;}
}
$("searchBtn").addEventListener("click",search);
$("location").addEventListener("keydown",e=>{if(e.key==="Enter")search();});
$("sort").addEventListener("change",render);
$("includeNearby").addEventListener("change",()=>{if($("location").value.trim())search();});
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
