/**
 * 1. DYNAMIC DATA LOADER
 */
function loadDataset() {
  return new Promise((resolve, reject) => {
    const urlParams = new URLSearchParams(window.location.search);
    // Default to data_melbourne.js if no parameter is provided
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

    // 1. Dynamic Metadata Updates
    if (typeof meta !== 'undefined') {
      if (meta.title) document.title = meta.title;
      const titleTextElement = document.getElementById('trip-title-text');
      if (titleTextElement && meta.title) titleTextElement.innerText = meta.title;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && meta.description) metaDesc.setAttribute('content', meta.description);
    }

    // 2. Initialize Platform
    platform = new H.service.Platform({ 
        apikey: window.apikey 
    });
    defaultLayers = platform.createDefaultLayers();

    // 3. Initialize Map (using coords from the dynamic dataset)
    map = new H.Map(document.getElementById('map'),
      defaultLayers.vector.normal.map, {
      center: { lat: coords[0][0], lng: coords[0][1] },
      zoom: 7,
      pixelRatio: window.devicePixelRatio || 1
    });

    // 4. Map Interactions
    window.addEventListener('resize', () => map.getViewPort().resize());
    behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    ui = H.ui.UI.createDefault(map, defaultLayers);

    // 5. Make button visible once map is ready
    const btn = document.getElementById('start-btn');
    if (btn) btn.style.display = 'flex';

  } catch (err) {
    console.error("Initialization failed:", err);
    // Fallback if data fails to load
    alert("Could not load travel data. Please check the URL.");
  }
}

/**
 * 3. NAVIGATION MENU (Fixes the ReferenceError)
 */
function navMenu() {
  var x = document.getElementById("nav-links");
  if (x) {
    x.style.display = (x.style.display === "block") ? "none" : "block";
  }
}

/**
 * 4. ANIMATION LOGIC
 */
async function startJourney() {
  const btn = document.getElementById('start-btn');
  if (btn) btn.style.display = 'none';

  // Optional: Show the very first starting point bubble before moving
  updateInfoBubble({ lat: coords[0][0], lng: coords[0][1] }, `Starting at: ${coords[0][2]}`);
  await new Promise(r => setTimeout(r, 1500));

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    // CHANGE: Show the NEXT destination bubble as the car starts driving toward it
    updateInfoBubble({ lat: end[0], lng: end[1] }, `Next: ${end[2]}`);

    // Drive the segment
    await animateDrivingSegment(start, end, 5);

    // Optional: Small pause upon arrival at the destination
    await new Promise(r => setTimeout(r, 800));
  }

  // Final State: Change bubble text to show arrival
  const last = coords[coords.length - 1];
  updateInfoBubble({ lat: last[0], lng: last[1] }, `Arrived at: ${last[2]}`);
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
 * Update Bubble Behaviour
 * Added a small vertical offset so the bubble doesn't sit directly on the coordinate
 */
function updateInfoBubble(pos, text) {
  if (currentBubble) ui.removeBubble(currentBubble);
  
  currentBubble = new H.ui.InfoBubble(pos, {
    content: `
      <div style="padding:10px; min-width:150px; color:black;">
        <div style="font-weight:bold; font-size:14px;">${text}</div>
      </div>`,
    // Offset helps visibility while the line is drawing underneath
    offset: { x: 0, y: -30 } 
  });
  
  ui.addBubble(currentBubble);
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

// Run the initialization
init();