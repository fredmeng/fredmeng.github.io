/**
 * 1. DYNAMIC DATA LOADER (Enhanced)
 */
let travelMode = 'car'; // Global tracker for mode

function loadDataset() {
  return new Promise((resolve, reject) => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataFile = urlParams.get('dataset') || '2026_melbourne.js';
    
    // Get mode from URL: car, bicycle, pedestrian, or truck
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
    defaultLayers = platform.createDefaultLayers({
    lg: 'zh-TW',
    });
    map = new H.Map(document.getElementById('map'), defaultLayers.vector.normal.map, {
      center: { lat: coords[0][0], lng: coords[0][1] },
      zoom: 8, // Increased default zoom for better visibility
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
    
    if (!isNaN(parseFloat(segmentKm))) {
      totalDistance += parseFloat(segmentKm);
    }

    showBubble({ lat: end[0], lng: end[1] }, `${end[2]}<br><small>${segmentKm} km</small>`, 2000);
    await new Promise(r => setTimeout(r, 2000));
  }

  showBubble(
    { lat: coords[coords.length - 1][0], lng: coords[coords.length - 1][1] }, 
    `Total Trip 總里程數: ${totalDistance.toFixed(1)} km`
  );
    
  isJourneyRunning = false;
}

async function animateDrivingSegment(startCoord, endCoord) {
  return new Promise((resolve) => {
    const router = platform.getRoutingService(null, 8);
    
    const modeMapping = {
      'car': 'car',
      'walking': 'pedestrian',
      'pedestrian': 'pedestrian',
      'cycling': 'bicycle',
      'bicycle': 'bicycle'
    };

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

    const runFallback = () => {
      console.warn("Routing failed or invalid geometry. Using direct-line fallback.");
      const fallbackPoints = getStraightLinePath(startCoord, endCoord);
      const directDist = getHaversineDistance(startCoord, endCoord).toFixed(1);
      growLineSegments(fallbackPoints, () => resolve(directDist));
    };

    (async () => {
      // 1. Try Primary Mode (from URL param)
      let section = await attemptRoute(modeMapping[travelMode] || 'car');

      // 2. Retry with Pedestrian if Primary failed or is suspiciously short
      if (!section || section.summary.length < 50) {
        const pedestrianSection = await attemptRoute('pedestrian');
        if (pedestrianSection && pedestrianSection.summary.length >= 50) {
          section = pedestrianSection;
        }
      }

      // 3. NEW: Final Retry with Car (only if current travelMode isn't already car)
      if ((!section || section.summary.length < 50) && travelMode !== 'car') {
        console.log("Pedestrian failed, retrying with car mode...");
        const carRetrySection = await attemptRoute('car');
        if (carRetrySection) section = carRetrySection;
      }

      // 4. Drawing Logic
      if (section && section.polyline) {
        const lineString = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const points = [];
        lineString.eachLatLngAlt((lat, lng) => points.push({ lat, lng }));
        
        if (points.length > 1) {
          const distanceKm = (section.summary.length / 1000).toFixed(1);
          growLineSegments(points, () => resolve(distanceKm));
        } else {
          runFallback();
        }
      } else {
        runFallback();
      }
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

function getStraightLinePath(start, end) {
  const points = [];
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const lat = start[0] + (end[0] - start[0]) * (i / steps);
    const lng = start[1] + (end[1] - start[1]) * (i / steps);
    points.push({ lat, lng });
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