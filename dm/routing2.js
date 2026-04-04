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
    
    script.onload = () => {
      console.log(`Dataset loaded: ${dataFile}`);
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error(`Failed to load dataset: ${dataFile}`));
    };
    
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

    // Update Metadata from the loaded dataset
    if (typeof meta !== 'undefined') {
      if (meta.title) document.title = meta.title;
      const titleTextElement = document.getElementById('trip-title-text');
      if (titleTextElement) titleTextElement.innerText = meta.title;
    }

    platform = new H.service.Platform({ apikey: window.apikey });
    defaultLayers = platform.createDefaultLayers();

    map = new H.Map(document.getElementById('map'),
      defaultLayers.vector.normal.map, {
      center: { lat: coords[0][0], lng: coords[0][1] },
      zoom: 7,
      pixelRatio: window.devicePixelRatio || 1
    });

    window.addEventListener('resize', () => map.getViewPort().resize());
    behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
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
function navMenu() {
  var x = document.getElementById("nav-links");
  if (x) {
    x.style.display = (x.style.display === "block") ? "none" : "block";
  }
}

/**
 * UI HELPERS & PIN LOGIC
 */

function addDestinationPin(pos, text) {
  // 1. Make the pin half size (Original was 32x32, now 16x16)
  const icon = new H.map.Icon('https://latitude900.com/shared/pin.png', {
    size: { w: 16, h: 16 },
    anchor: { x: 8, y: 16 } // Anchor at the bottom center of the smaller pin
  });

  const marker = new H.map.Marker(pos, { icon: icon });
  
  // Store the destination name inside the marker for retrieval
  marker.setData(text);

  // 2. Make the pin clickable (tap event)
  // 3. Display the pop up window after clicking
  marker.addEventListener('tap', (evt) => {
    // Close existing bubble if one is open
    if (currentBubble) ui.removeBubble(currentBubble);

    // Create and show the new InfoBubble
    currentBubble = new H.ui.InfoBubble(evt.target.getGeometry(), {
      content: `
        <div style="padding:8px; min-width:100px; color:black; font-family:sans-serif;">
          <div style="font-size:11px; color:#777; margin-bottom:2px;">Location</div>
          <div style="font-weight:bold; font-size:13px;">${evt.target.getData()}</div>
        </div>`
    });
    ui.addBubble(currentBubble);
  });

  map.addObject(marker);
}

/**
 * ANIMATION ENGINE
 */
async function startJourney() {
  const btn = document.getElementById('start-btn');
  if (btn) btn.style.display = 'none';

  // Drop the very first pin (Origin)
  addDestinationPin({ lat: coords[0][0], lng: coords[0][1] }, coords[0][2]);

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    // Drop the NEXT destination pin (Half-size, clickable)
    addDestinationPin({ lat: end[0], lng: end[1] }, end[2]);
    
    // Brief pause to look at the new pin before driving
    await new Promise(r => setTimeout(r, 1000));

    // Animate the car driving along the route
    await animateDrivingSegment(start, end, 5);
  }
}

function animateDrivingSegment(startCoord, endCoord, speed) {
  return new Promise((resolve) => {
    const router = platform.getRoutingService(null, 8);
    const params = {
      'routingMode': 'fast',
      'transportMode': 'car',
      'origin': `${startCoord[0]},${startCoord[1]}`,
      'destination': `${endCoord[0]},${endCoord[1]}`,
      'return': 'polyline'
    };

    router.calculateRoute(params, (result) => {
      if (result.routes && result.routes.length) {
        const section = result.routes[0].sections[0];
        const lineString = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const points = [];
        lineString.eachLatLngAlt((lat, lng) => points.push({ lat, lng }));
        growLineSegments(points, speed, resolve);
      } else {
        resolve();
      }
    }, resolve);
  });
}

function growLineSegments(points, speed, onComplete) {
  let i = 0;
  const segmentGroup = new H.map.Group();
  map.addObject(segmentGroup);

  function animate() {
    if (i < points.length - 1) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const stepLS = new H.geo.LineString();
      stepLS.pushPoint(p1);
      stepLS.pushPoint(p2);

      const stepPoly = new H.map.Polyline(stepLS, {
        style: { lineWidth: 4, strokeColor: 'rgba(0, 128, 255, 0.7)' }
      });

      segmentGroup.addObject(stepPoly);
      map.setCenter(p2);
      i++;
      setTimeout(animate, speed);
    } else {
      onComplete();
    }
  }
  animate();
}

/**
 * 5. EVENT LISTENERS
 */
document.getElementById('start-btn').addEventListener('click', () => {
  const music = document.getElementById('bg-music');
  if (music) {
    music.volume = 0.3;
    music.play().catch(() => {});
  }
  startJourney();
});

// Run initialization
init();