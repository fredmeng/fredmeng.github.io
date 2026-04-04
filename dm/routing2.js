/**
 * 2. GLOBAL VARIABLES & INITIALIZATION
 */
var platform, defaultLayers, map, behavior, ui, currentBubble;
var markers = []; // Array to keep track of all pins displayed

// ... keep your loadDataset() and init() functions as they are ...

/**
 * 3. UI HELPERS
 */
function navMenu() {
  var x = document.getElementById("nav-links");
  if (x) {
    x.style.display = (x.style.display === "block") ? "none" : "block";
  }
}

/**
 * NEW: Creates a permanent pin and attaches a click listener
 */
function addDestinationPin(pos, text) {
  const icon = new H.map.Icon('https://latitude900.com/shared/pin.png', {
    size: { w: 32, h: 32 },
    anchor: { x: 16, y: 32 }
  });

  const marker = new H.map.Marker(pos, { icon: icon });
  
  // Store the destination name inside the marker object for retrieval on click
  marker.setData(text);

  // Add click listener to the marker
  marker.addEventListener('tap', (evt) => {
    // Close any existing bubble
    if (currentBubble) ui.removeBubble(currentBubble);

    // Create a new bubble at the pin's position
    currentBubble = new H.ui.InfoBubble(evt.target.getGeometry(), {
      content: `<div style="padding:10px; min-width:120px; color:black; font-weight:bold;">${evt.target.getData()}</div>`
    });
    ui.addBubble(currentBubble);
  });

  map.addObject(marker);
  markers.push(marker);
}

/**
 * 4. ANIMATION ENGINE
 */
async function startJourney() {
  document.getElementById('start-btn').style.display = 'none';

  // 1. Show the starting point pin immediately
  addDestinationPin({ lat: coords[0][0], lng: coords[0][1] }, coords[0][2]);

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    // 2. Drop the pin for the NEXT destination before drawing the line
    addDestinationPin({ lat: end[0], lng: end[1] }, end[2]);
    
    // Brief pause before driving
    await new Promise(r => setTimeout(r, 1000));

    // 3. Animate the car driving
    await animateDrivingSegment(start, end, 5);
  }
}

/**
 * Update the calculateRoute and growLineSegments functions 
 * (Ensure you are using the 'mapsjs-mapevents.js' for the 'tap' listener)
 */
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

init();