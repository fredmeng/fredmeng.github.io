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

    // 1. Update the Browser Tab Title
    if (typeof meta !== 'undefined' && meta.title) {
      document.title = meta.title;
      
      // 2. Update the Visible Trip Title on the page
      const titleTextElement = document.getElementById('trip-title-text');
      if (titleTextElement) {
        titleTextElement.innerText = meta.title;
      }

      // 3. Update Meta Description (for SEO/Browsers)
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && meta.description) {
        metaDesc.setAttribute('content', meta.description);
      }
    }

    // Existing Map initialization code...
    platform = new H.service.Platform({ apikey: window.apikey });
    // ... rest of your init() code
  } catch (err) {
    console.error("Initialization failed:", err);
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
  document.getElementById('start-btn').style.display = 'none';

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    updateInfoBubble({ lat: start[0], lng: start[1] }, start[2]);
    await new Promise(r => setTimeout(r, 1000));
    await animateDrivingSegment(start, end, 5);
  }

  const last = coords[coords.length - 1];
  updateInfoBubble({ lat: last[0], lng: last[1] }, last[2]);
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

function updateInfoBubble(pos, text) {
  if (currentBubble) ui.removeBubble(currentBubble);
  currentBubble = new H.ui.InfoBubble(pos, {
    content: `<div style="padding:5px; font-weight:bold; color:black;">${text}</div>`
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