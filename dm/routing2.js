/**
 * 1. DYNAMIC DATA LOADER
 * Fetches the dataset file based on the URL parameter ?dataset=filename.js
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
    // Wait for the .js data file to load
    await loadDataset();

    // Update dynamic page titles from the loaded 'meta' object
    if (typeof meta !== 'undefined') {
      if (meta.title) document.title = meta.title;
      const titleTextElement = document.getElementById('trip-title-text');
      if (titleTextElement) titleTextElement.innerText = meta.title;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && meta.description) metaDesc.setAttribute('content', meta.description);
    }

    // Initialize HERE Platform & Map
    platform = new H.service.Platform({ apikey: window.apikey });
    defaultLayers = platform.createDefaultLayers();

    map = new H.Map(document.getElementById('map'),
      defaultLayers.vector.normal.map, {
      center: { lat: coords[0][0], lng: coords[0][1] },
      zoom: 7,
      pixelRatio: window.devicePixelRatio || 1
    });

    window.addEventListener('resize', () => map.getViewPort().resize());

    // CRITICAL: Enables map interaction (panning, zooming, and CLICKING pins)
    var mapEvents = new H.mapevents.MapEvents(map);
    behavior = new H.mapevents.Behavior(mapEvents);
    ui = H.ui.UI.createDefault(map, defaultLayers);

    // Make start button visible once everything is ready
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

function addDestinationPin(pos, text, htmlContent) {
  const icon = new H.map.Icon('https://latitude900.com/shared/pin.png', {
    size: { w: 16, h: 16 },
    anchor: { x: 8, y: 16 }
  });

  const marker = new H.map.Marker(pos, { icon: icon });
  
  // Store the HTML string in the marker's data
  // If htmlContent is provided, use it; otherwise, fall back to the plain text
  marker.setData(htmlContent || `<div style="font-weight:bold;">${text}</div>`);

  marker.addEventListener('tap', (evt) => {
    if (currentBubble) ui.removeBubble(currentBubble);

    currentBubble = new H.ui.InfoBubble(evt.target.getGeometry(), {
      content: evt.target.getData() // This now renders as HTML
    });
    ui.addBubble(currentBubble);
    
    // Auto-close after 3 seconds as per previous requirement
    setTimeout(() => {
      if (currentBubble) {
        ui.removeBubble(currentBubble);
        currentBubble = null;
      }
    }, 3000);
  });

  map.addObject(marker);
}

function showTempBubble(pos, text) {
  // Close existing bubble
  if (currentBubble) ui.removeBubble(currentBubble);

  currentBubble = new H.ui.InfoBubble(pos, {
    content: `<div style="padding:10px; font-weight:bold; color:black;">${text}</div>`
  });
  
  ui.addBubble(currentBubble);

  // Auto-close after 3 seconds
  setTimeout(() => {
    if (currentBubble) {
      ui.removeBubble(currentBubble);
      currentBubble = null;
    }
  }, 3000);
}

/**
 * 4. ANIMATION ENGINE
 */
/**
 * ANIMATION ENGINE
 * Handles the drop of pins and the driving animation sequence.
 * Expects coords to be structured as: [lat, lng, name, htmlContent]
 */
async function startJourney() {
  const btn = document.getElementById('start-btn');
  if (btn) btn.style.display = 'none';

  // 1. Show the starting point (Index 0)
  // We pass coords[0][2] as text and coords[0][3] as the HTML content
  addDestinationPin({ lat: coords[0][0], lng: coords[0][1] }, coords[0][2], coords[0][3]);
  showTempBubble({ lat: coords[0][0], lng: coords[0][1] }, coords[0][3] || `Starting at: ${coords[0][2]}`);

  // 2. Loop through the trip segments
  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    // 3. Drop the NEXT destination pin
    // Note: We use end[3] for the HTML content of the next destination
    addDestinationPin({ lat: end[0], lng: end[1] }, end[2], end[3]);
    
    // 4. Show the bubble for the NEXT destination automatically
    // If no HTML is provided in the array, it defaults to a standard "Next:" string
    const bubbleContent = end[3] || `Next: ${end[2]}`;
    showTempBubble({ lat: end[0], lng: end[1] }, bubbleContent);
    
    // 5. Brief pause so the user sees the pin and the bubble before driving
    await new Promise(r => setTimeout(r, 1500));

    // 6. Drive to the next town
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
  const pointsPerFrame = 10; // The "Sweet Spot" for speed and smoothness
  const segmentGroup = new H.map.Group();
  map.addObject(segmentGroup);

  function animate() {
    let pointsProcessedThisFrame = 0;

    // Process a batch of points in one go
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
      // Still more to draw? Center the map on the current "lead" and go to next frame
      map.setCenter(points[i]);
      requestAnimationFrame(animate);
    } else {
      // We are done! Final center and resolve
      map.setCenter(points[points.length - 1]);
      onComplete();
    }
  }
  
  requestAnimationFrame(animate);
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