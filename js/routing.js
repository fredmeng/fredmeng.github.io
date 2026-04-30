/**
 * 1. DYNAMIC DATA LOADER
 */
let travelMode = 'car'; 

function loadDataset() {
  return new Promise((resolve, reject) => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataFile = urlParams.get('dataset') || '2026_melbourne.js';
    travelMode = urlParams.get('mode') || 'car'; 
    
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `/data/${dataFile}`;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load dataset: ${dataFile}`));
    document.head.appendChild(script);
  });
}

/**
 * 2. GLOBAL VARIABLES & INITIALIZATION
 */
var platform, defaultLayers, map, behavior, ui, currentBubble;
var isJourneyRunning = false; 

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
      zoom: 8, // Increased zoom for better visibility in terrain
      pixelRatio: window.devicePixelRatio || 1
    });

    window.addEventListener('resize', () => map.getViewPort().resize());
    new H.mapevents.MapEvents(map);
    behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    ui = H.ui.UI.createDefault(map, defaultLayers);
    
    const btn = document.getElementById('start-btn');
    if (btn) btn.style.display = 'flex';
  } catch (err) {
    console.error("Initialization failed:", err);
  }
}

/**
 * 3. UI HELPERS
 */
function addDestinationPin(pos, text) {
  const icon = new H.map.Icon('https://latitude900.com/image/pin.png', {
    size: { w: 16, h: 16 },
    anchor: { x: 8, y: 16 }
  });
  const marker = new H.map.Marker(pos, { icon: icon });
  marker.setData(text);
  marker.addEventListener('tap', (evt) => showBubble(evt.target.getGeometry(), evt.target.getData(), null));
  map.addObject(marker);
}

function showBubble(pos, text, duration = null) {
  if (currentBubble) ui.removeBubble(currentBubble);
  currentBubble = new H.ui.InfoBubble(pos, {
    content: `<div style="padding:10px; font-weight:bold; color:black;">${text}</div>`
  });
  ui.addBubble(currentBubble);

  if (duration) {
    setTimeout(() => {
      if (currentBubble) {
        ui.removeBubble(currentBubble);
        currentBubble = null;
      }
    }, duration);
  }
}

/**
 * 4. ANIMATION ENGINE
 */
async function startJourney() {
  if (isJourneyRunning) return;
  isJourneyRunning = true;
  
  document.getElementById('start-btn').style.display = 'none';
  let totalDistance = 0;

  addDestinationPin({ lat: coords[0][0], lng: coords[0][1] }, coords[0][2]);
  showBubble({ lat: coords[0][0], lng: coords[0][1] }, coords[0][2], 2000);

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    addDestinationPin({ lat: end[0], lng: end[1] }, end[2]);
    const segmentKm = await animateDrivingSegment(start, end);
    
    if (!isNaN(parseFloat(segmentKm))) totalDistance += parseFloat(segmentKm);

    showBubble({ lat: end[0], lng: end[1] }, `${end[2]}<br><small>${segmentKm} km</small>`, 2000);
    await new Promise(r => setTimeout(r, 2000));
  }

  showBubble(
    { lat: coords[coords.length - 1][0], lng: coords[coords.length - 1][1] }, 
    `Total Trip 總里程數: ${totalDistance.toFixed(1)} km`
  );
  isJourneyRunning = false;
}

function animateDrivingSegment(startCoord, endCoord) {
  return new Promise((resolve) => {
    const router = platform.getRoutingService(null, 8);
    
    const attemptRoute = (mode) => {
      return new Promise((innerResolve) => {
        router.calculateRoute({
          'routingMode': 'fast',
          'transportMode': mode,
          'origin': `${startCoord[0]},${startCoord[1]}`,
          'destination': `${endCoord[0]},${endCoord[1]}`,
          'return': 'polyline,summary'
        }, 
        res => innerResolve(res.routes?.[0]?.sections?.[0] || null),
        () => innerResolve(null));
      });
    };

    (async () => {
      // 1. Try Primary Mode (Car/Bicycle)
      let section = await attemptRoute(travelMode);

      // 2. Threshold Check: If < 50m OR route failed, try Pedestrian
      if (!section || section.summary.length < 50) {
        console.log("Segment failed or < 50m. Attempting Pedestrian...");
        section = await attemptRoute('pedestrian');
      }

      // 3. Final Validation & Drawing
      // We check for section.polyline to ensure the API actually returned geometry
      if (section && section.polyline) {
        const lineString = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const points = [];
        lineString.eachLatLngAlt((lat, lng) => points.push({ lat, lng }));
        
        // Final sanity check: If polyline exists but has no points, failover.
        if (points.length > 1) {
          growLineSegments(points, () => resolve((section.summary.length / 1000).toFixed(1)));
          return;
        }
      }

      // 4. Failover Solution (Straight Line)
      console.warn("Routing failed to provide geometry. Triggering direct line.");
      const fallbackPoints = getStraightLinePath(startCoord, endCoord);
      const directDist = getHaversineDistance(startCoord, endCoord).toFixed(1);
      growLineSegments(fallbackPoints, () => resolve(directDist));
    })();
  });
}

function growLineSegments(points, onComplete) {
  let i = 0;
  let pointsPerFrame = 15; 
  if (travelMode === 'bicycle' || travelMode === 'cycling') pointsPerFrame = 8;
  if (travelMode === 'pedestrian' || travelMode === 'walking') pointsPerFrame = 4;

  const segmentGroup = new H.map.Group();
  map.addObject(segmentGroup);

  function animate() {
    let processed = 0;
    while (processed < pointsPerFrame && i < points.length - 1) {
      const stepLS = new H.geo.LineString();
      stepLS.pushPoint(points[i]);
      stepLS.pushPoint(points[i + 1]);
      
      segmentGroup.addObject(new H.map.Polyline(stepLS, {
        style: { lineWidth: 4, strokeColor: 'rgba(0, 128, 255, 0.7)' }
      }));
      i++;
      processed++;
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

function getStraightLinePath(start, end) {
  const points = [];
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    points.push({
      lat: start[0] + (end[0] - start[0]) * (i / steps),
      lng: start[1] + (end[1] - start[1]) * (i / steps)
    });
  }
  return points;
}

function getHaversineDistance(p1, p2) {
  const R = 6371;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * 5. EVENT LISTENERS
 */
document.getElementById('start-btn').addEventListener('click', () => {
  if (isJourneyRunning) return;
  const music = document.getElementById('bg-music');
  if (music) { music.volume = 0.3; music.play().catch(() => {}); }
  startJourney();
});

init();