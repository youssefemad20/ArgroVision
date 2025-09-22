// Lightweight dashboard script: loads CSVs and renders charts + irrigation status
// Uses global Chart and Papa (from CDN inclusions in framoverview.html)

async function loadCSV(path){
  return new Promise((resolve,reject)=>{
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (res)=> resolve(res.data),
      error: (err)=> reject(err)
    })
  })
}

function formatDates(rows){
  return rows.map(r => r.date);
}

function extract(rows, key){
  return rows.map(r => r[key]);
}

function renderLineChart(ctx, labels, datasets, options={}){
  return new Chart(ctx,{type:'line',data:{labels, datasets}, options: Object.assign({responsive:true, maintainAspectRatio:false}, options)});
}

function decideIrrigation(analyzedRows){
  // Simple rule: needs_irrigation true override; else if recent 3-day rain sum < 5mm and humidity < 55 => need
  // Support crop-specific thresholds via window.selectedCropProfile
  const crop = window.selectedCropProfile || {name:'generic', rainThreshold:5, humidityThreshold:55};
  if(!analyzedRows || analyzedRows.length===0) return {status:'Unknown', reason:'No data'};
  const latest = analyzedRows[analyzedRows.length-1];
  if('needs_irrigation' in latest && latest.needs_irrigation) return {status:'Needs Irrigation', reason:'analyzed flag'};
  // fallback heuristic using last 3 days from weather data if available via global weatherRows
  if(window.weatherRows && window.weatherRows.length>0){
    const last3 = window.weatherRows.slice(-3);
    const rainSum = last3.reduce((s,r)=>s + (Number(r.rain_mm)||0),0);
    const humidity = last3[last3.length-1].rh2m_pct || last3[last3.length-1].humidity_pct || null;
    if(rainSum < (crop.rainThreshold || 5) && (humidity===null || humidity < (crop.humidityThreshold || 55))) return {status:'Needs Irrigation', reason:`Low recent rain (${rainSum}mm) and humidity ${humidity}`};
    return {status:'OK', reason:`Recent rain ${rainSum}mm (threshold ${crop.rainThreshold}mm)`};
  }
  return {status:'OK', reason:'No weather rows to analyze'};
}

// --- Crop profiles & UI integration ---
window.cropProfiles = {
  wheat: {name:'Wheat', rainThreshold:8, humidityThreshold:60, desc:'Wheat prefers moderate moisture; avoid waterlogging.', growth:'80% (Good)', recommended_mm:8, projected_yield:'4.2 tons/ha', tips:'Keep soil evenly moist; fertilize at tillering and booting stages.', image:'wheat.jpg'},
  corn: {name:'Corn', rainThreshold:10, humidityThreshold:55, desc:'Corn needs higher water during tasseling and grain-fill stages.', growth:'85% (Good)', recommended_mm:12, projected_yield:'6.0 tons/ha', tips:'Ensure adequate N; irrigate heavily during tassel and grain-fill.', image:'corn.jpg'},
  potatoes: {name:'Potatoes', rainThreshold:6, humidityThreshold:60, desc:'Potatoes like consistent moisture; avoid drought stress.', growth:'78% (Fair)', recommended_mm:10, projected_yield:'20 tons/ha', tips:'Maintain even moisture; avoid overwatering during tuber bulking.', image:'potato.jpg'},
  tomatoes: {name:'Tomatoes', rainThreshold:5, humidityThreshold:55, desc:'Tomatoes need steady moisture and good sunlight; watch for fungal disease in high humidity.', growth:'95% (Excellent)', recommended_mm:10, projected_yield:'12.5 tons/ha', tips:'Provide 6-8 hours sunlight; use drip irrigation to reduce disease.', image:'tomato.jpg'},
  peppers: {name:'Peppers', rainThreshold:5, humidityThreshold:55, desc:'Peppers prefer well-drained soils and regular irrigation.', growth:'88% (Good)', recommended_mm:8, projected_yield:'7.0 tons/ha', tips:'Avoid waterlogged soils; feed during fruiting.', image:'paper.jpg'},
  apples: {name:'Apples', rainThreshold:7, humidityThreshold:60, desc:'Apples need balanced water; monitor during fruit set and enlargement.', growth:'82% (Good)', recommended_mm:10, projected_yield:'30 tons/ha', tips:'Thin excess fruit and monitor calcium levels to avoid blossom end rot.', image:'apple.jpg'},
  grapes: {name:'Grapes', rainThreshold:4, humidityThreshold:50, desc:'Grapes tolerate drier conditions; excess water can reduce quality.', growth:'90% (Good)', recommended_mm:5, projected_yield:'10 tons/ha', tips:'Control vigor with deficit irrigation; avoid high humidity during ripening.', image:'graps.jpg'},
  lettuce: {name:'Lettuce', rainThreshold:6, humidityThreshold:65, desc:'Lettuce prefers cool, moist conditions and partial shade in heat.', growth:'75% (Fair)', recommended_mm:6, projected_yield:'25 tons/ha', tips:'Keep soil cool and moist; use shade in summer to prevent bolting.', image:'luttuce.jpg'},
};

// default image used if profile has no image
window.defaultCropImage = 'paper.jpg';

function applyCropSelection(key){
  // normalize incoming key (allow 'Tomatoes' or 'tomatoes')
  const normalizedKey = key ? String(key).toLowerCase() : null;
  const profile = normalizedKey ? window.cropProfiles[normalizedKey] || null : null;
  window.selectedCropProfile = profile;
  // save normalized selection
  if(normalizedKey) localStorage.setItem('selectedCrop', normalizedKey); else localStorage.removeItem('selectedCrop');
  // sync any crop-select elements on the page using normalized value
  try{
    document.querySelectorAll('select#crop-select').forEach(s=>{ s.value = normalizedKey || ''; });
  }catch(e){/* ignore in non-browser env */}
  // Debug: create/update a visible badge so user can see selection applied
  try{
    let dbg = document.getElementById('crop-debug');
    if(!dbg){ dbg = document.createElement('div'); dbg.id = 'crop-debug'; dbg.style.position='fixed'; dbg.style.right='12px'; dbg.style.bottom='12px'; dbg.style.background='#0f5132'; dbg.style.color='#d1fae5'; dbg.style.padding='8px 12px'; dbg.style.borderRadius='8px'; dbg.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'; dbg.style.zIndex = 99999; document.body.appendChild(dbg); }
    dbg.textContent = key ? ('Selected crop: ' + key) : 'No crop selected';
  }catch(e){/* ignore */}
  console.log('applyCropSelection called for', normalizedKey, profile);
  // update cropstutes UI if present
  const nameEl = document.getElementById('crop-name');
  const descEl = document.getElementById('crop-desc');
  const growthEl = document.getElementById('crop-growth');
  const soilEl = document.getElementById('soil-moisture-value');
  const nextIrr = document.getElementById('next-irrigation');
  const recWater = document.getElementById('recommended-water');
  const yieldEl = document.getElementById('projected-yield');
  if(profile){
    if(nameEl) nameEl.textContent = profile.name;
    if(descEl) descEl.textContent = profile.desc;
    if(growthEl) growthEl.textContent = profile.growth;
    if(soilEl) soilEl.textContent = Math.round((profile.humidityThreshold||60)-5) + '%'; // heuristic for display
    if(nextIrr) nextIrr.textContent = 'Tomorrow';
    if(recWater) recWater.textContent = 'Recommended: ' + (profile.recommended_mm || 10) + 'mm';
    if(yieldEl) yieldEl.textContent = profile.projected_yield || '';
    // Update hero title/tips and image if present
    const heroTitle = document.getElementById('crop-hero-title');
    if(heroTitle) heroTitle.textContent = 'Optimal Growth Tips for ' + profile.name;
  // use profile image or fallback
  const heroImg = document.getElementById('crop-hero-image');
  const useImg = (profile && profile.image) ? profile.image : (window.defaultCropImage || null);
  if(heroImg && useImg) heroImg.style.backgroundImage = `url('${useImg}')`;
    // also update framoverview section ids if present
    const frameTitle = document.getElementById('crop-title');
    if(frameTitle) frameTitle.textContent = 'Optimal Growth Tips for ' + profile.name;
  const frameImg = document.getElementById('crop-image');
  if(frameImg && useImg) frameImg.style.backgroundImage = `url('${useImg}')`;
  const tipsEl = document.getElementById('crop-desc');
    if(tipsEl && profile.tips) tipsEl.textContent = profile.tips;
    const frameTips = document.getElementById('crop-tips');
    if(frameTips && profile.tips) frameTips.textContent = profile.tips;
  } else {
    if(nameEl) nameEl.textContent = '—';
    if(descEl) descEl.textContent = '';
  }
  // If framoverview is loaded, re-run dashboard calculations so irrigation uses new thresholds
  try{ if(typeof initDashboard === 'function') initDashboard(); }catch(e){/* ignore */}
}

async function initDashboard(){
  try{
    const weather = await loadCSV('weather_clean_daily.csv');
    const analyzed = await loadCSV('weather_clean_daily_analyzed.csv');
    window.weatherRows = weather.filter(r=>r.date);
    window.analyzedRows = analyzed.filter(r=>r.date);
    const errorEl = document.getElementById('data-error');
    if(errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }

    // If no weather rows found, surface an explanation (likely blocked by file:// CORS)
    if(!window.weatherRows || window.weatherRows.length===0){
      const msg = 'No weather data found. If you opened the page with file:// your browser may block loading CSV files. Run a local server (see README) or open via http://localhost.';
      if(errorEl){ errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
      console.warn(msg);
      return;
    }

  // Build charts
  const labels = formatDates(window.weatherRows);
  // support both possible column names from CSVs
  const tempKey = window.weatherRows[0] && ('t2m_c' in window.weatherRows[0]) ? 't2m_c' : 'temperature_c';
  const rainKey = window.weatherRows[0] && ('rain_mm' in window.weatherRows[0]) ? 'rain_mm' : 'rain_mm';
  const humidityKey = window.weatherRows[0] && ('rh2m_pct' in window.weatherRows[0]) ? 'rh2m_pct' : 'humidity_pct';
  const tempData = extract(window.weatherRows, tempKey);
  const rainData = extract(window.weatherRows, rainKey);
  const humidityData = extract(window.weatherRows, humidityKey);

    // Create placeholder canvases if not present
    const tempCanvas = document.getElementById('chart-temp');
    const rainCanvas = document.getElementById('chart-rain');

    if(tempCanvas){
      const chart = renderLineChart(tempCanvas.getContext('2d'), labels, [{label:'Temperature (°C)', data:tempData, borderColor:'#ff6b6b', backgroundColor:'rgba(255,107,107,0.08)', tension:0.2, fill:true}]);
      // set current temp display
      const tempCurrent = document.getElementById('temp-current');
      if(tempCurrent && tempData.length) tempCurrent.textContent = Math.round(tempData[tempData.length-1]) + '°C';
    }
    if(rainCanvas){
      renderLineChart(rainCanvas.getContext('2d'), labels, [{label:'Rain (mm)', data:rainData, borderColor:'#17cf17', backgroundColor:'rgba(23,207,23,0.08)', tension:0.2, fill:true, yAxisID:'y'}], {scales:{y:{beginAtZero:true}}});
      const rainTotal = document.getElementById('rain-total');
      if(rainTotal) {
        const sum = rainData.reduce((s,v)=>s + (Number(v)||0), 0);
        rainTotal.textContent = (Math.round(sum*10)/10) + ' mm';
      }
    }

    // Irrigation status
    const irrig = decideIrrigation(window.analyzedRows);
    const statusEl = document.getElementById('irrigation-status');
    if(statusEl){
      statusEl.textContent = irrig.status;
      statusEl.classList.remove('text-red-600','text-green-600','text-yellow-500');
      if(irrig.status.toLowerCase().includes('need')) statusEl.classList.add('text-red-600');
      else if(irrig.status.toLowerCase().includes('ok')) statusEl.classList.add('text-green-600');
      else statusEl.classList.add('text-yellow-500');
      const reasonEl = document.getElementById('irrigation-reason');
      if(reasonEl) reasonEl.textContent = irrig.reason || '';
    }

  }catch(e){
  console.error('Dashboard init failed', e);
  const errorEl = document.getElementById('data-error');
  const msg = 'Failed to load data files: ' + (e && e.message ? e.message : String(e));
  if(errorEl){ errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
  }
}

// Init after DOM ready
function initCropSelector(){
  const sels = Array.from(document.querySelectorAll('select#crop-select'));
  if(sels.length===0) return;
  // restore from localStorage
  const saved = localStorage.getItem('selectedCrop');
  if(saved){ sels.forEach(s=>s.value = saved); applyCropSelection(saved); }
  sels.forEach(sel=>{
    sel.addEventListener('change', (e)=>{
      const key = e.target.value || null;
      applyCropSelection(key);
    });
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=>{ initDashboard(); initCropSelector(); });
} else { initDashboard(); initCropSelector(); }

// listen for storage changes (cross-tab) to update UI
window.addEventListener('storage', (ev)=>{
  if(ev.key === 'selectedCrop'){
    const key = ev.newValue;
    // update the selector on this page if present
    const sel = document.getElementById('crop-select');
    if(sel) sel.value = key || '';
    applyCropSelection(key);
  }
});
