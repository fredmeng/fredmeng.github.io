/**
 * 1. DYNAMIC DATA LOADER
 */
function loadDataset() {
  return new Promise((resolve, reject) => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataFile = urlParams.get('dataset') || 'data_melbourne.js';
    
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `/dm/${dataFile}`;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load dataset: ${dataFile}`));
    document.head.appendChild(script);
  });
}

/**
 * 2. GLOBAL VARIABLES & INITIALIZATION
 */
var platform, defaultLayers, map, behavior, ui, currentBubble;

async function init() {
  try {
    await loadDataset();
    if (typeof meta !== 'undefined') {
      if (meta.title) document.title = meta.title;
      const titleTextElement = document.getElementById('trip-title-text');
      if (titleTextElement) titleTextElement.innerText = meta.title;
    }

    platform = new H.service.Platform({ apikey: window.apikey });
    defaultLayers = platform.createDefaultLayers();
    map = new H.Map(document.getElementById('map'), defaultLayers.vector.normal.map, {
      center: { lat: coords[0][0], lng: coords[0][1] },
      zoom: 7,
      pixelRatio: window.devicePixelRatio || 1
    });

    window.addEventListener('resize', () => map.getViewPort().resize());
    var mapEvents = new H.mapevents.MapEvents(map);
    behavior = new H.mapevents.Behavior(mapEvents);
    ui = H.ui.UI.createDefault(map, defaultLayers);
    const btn = document.getElementById('start-btn');
    if (btn) btn.style.display = 'flex';
  } catch (err) {
    console.error("Initialization failed:", err);
  }
}

/**
 * 3. UI HELPERS & PIN LOGIC
 */
function addDestinationPin(pos, text) {
  const icon = new H.map.Icon('https://latitude900.com/shared/pin.png', {
    size: { w: 16, h: 16 },
    anchor: { x: 8, y: 16 }
  });
  const marker = new H.map.Marker(pos, { icon: icon });
  marker.setData(text);
  marker.addEventListener('tap', (evt) => showTempBubble(evt.target.getGeometry(), evt.target.getData()));
  map.addObject(marker);
}

function showTempBubble(pos, text) {
  if (currentBubble) ui.removeBubble(currentBubble);
  currentBubble = new H.ui.InfoBubble(pos, {
    content: `<div style="padding:10px; font-weight:bold; color:black;">${text}</div>`
  });
  ui.addBubble(currentBubble);
  setTimeout(() => { if (currentBubble) { ui.removeBubble(currentBubble); currentBubble = null; } }, 4000); // 4s to read distance
}

/**
 * 4. ANIMATION ENGINE
 */
async function startJourney() {
  document.getElementById('start-btn').style.display = 'none';
  let totalDistance = 0;

  addDestinationPin({ lat: coords[0][0], lng: coords[0][1] }, coords[0][2]);
  showTempBubble({ lat: coords[0][0], lng: coords[0][1] }, coords[0][2]);

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    // 1. Drop the NEXT pin
    addDestinationPin({ lat: end[0], lng: end[1] }, end[2]);
    
    // 2. Drive the route and get distance back
    const segmentKm = await animateDrivingSegment(start, end);
    totalDistance += parseFloat(segmentKm);

    // 3. Show bubble with distance
    showTempBubble({ lat: end[0], lng: end[1] }, `${end[2]}<br><small>${segmentKm} km</small>`);
    
    await new Promise(r => setTimeout(r, 1000));
  }

  // Final Total Display
  setTimeout(() => {
    showTempBubble({ lat: coords[coords.length - 1][0], lng: coords[coords.length - 1][1] }, 
    `Total Trip: ${totalDistance.toFixed(1)} km`);
  }, 2000);
}

function animateDrivingSegment(startCoord, endCoord) {
  return new Promise((resolve) => {
    const router = platform.getRoutingService(null, 8);
    const params = {
      'routingMode': 'fast',
      'transportMode': 'car',
      'origin': `${startCoord[0]},${startCoord[1]}`,
      'destination': `${endCoord[0]},${endCoord[1]}`,
      'return': 'polyline,summary'
    };

    router.calculateRoute(params, (result) => {
      if (result.routes && result.routes.length) {
        const section = result.routes[0].sections[0];
        // Calculate distance in km
        const distanceKm = (section.summary.length / 1000).toFixed(1);
        
        const lineString = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const points = [];
        lineString.eachLatLngAlt((lat, lng) => points.push({ lat, lng }));
        
        growLineSegments(points, () => resolve(distanceKm));
      } else {
        resolve(0);
      }
    }, () => resolve(0));
  });
}

function growLineSegments(points, onComplete) {
  let i = 0;
  const pointsPerFrame = 15;
  const segmentGroup = new H.map.Group();
  map.addObject(segmentGroup);

  function animate() {
    let pointsProcessedThisFrame = 0;
    while (pointsProcessedThisFrame < pointsPerFrame && i < points.length - 1) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const stepLS = new H.geo.LineString();
      stepLS.pushPoint(p1);
      stepLS.pushPoint(p2);
      const stepPoly = new H.map.Polyline(stepLS, {
        style: { lineWidth: 4, strokeColor: 'rgba(0, 128, 255, 0.7)' }
      });
      segmentGroup.addObject(stepPoly);
      i++;
      pointsProcessedThisFrame++;
    }

    if (i < points.length - 1) {
      map.setCenter(points[i]);
      requestAnimationFrame(animate);
    } else {
      map.setCenter(points[points.length - 1]);
      onComplete();
    }
  }
  requestAnimationFrame(animate);
}

document.getElementById('start-btn').addEventListener('click', () => {
  const music = document.getElementById('bg-music');
  if (music) { music.volume = 0.3; music.play().catch(() => {}); }
  startJourney();
});

init();