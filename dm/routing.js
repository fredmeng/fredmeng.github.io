// 1. Initialize Platform & Map
var platform = new H.service.Platform({
  apikey: window.apikey || 'YOUR_ACTUAL_API_KEY_HERE' 
});

var defaultLayers = platform.createDefaultLayers();

var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map, {
    center: { lat: -33.8804, lng: 151.1155 },
    zoom: 7,
    pixelRatio: window.devicePixelRatio || 1
  });

window.addEventListener('resize', () => map.getViewPort().resize());

var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
var ui = H.ui.UI.createDefault(map, defaultLayers);
var currentBubble = null;

/**
 * ANIMATION ENGINE
 */

async function startJourney() {
  // Check if coords is loaded from data.js
  if (typeof coords === 'undefined') {
    console.error("Data.js failed to load. 'coords' is not defined.");
    return;
  }

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];

    updateInfoBubble({ lat: start[0], lng: start[1] }, start[2]);
    
    // Pause for 1 second at each town
    await new Promise(r => setTimeout(r, 1000));

    // Request route and animate
    await animateDrivingSegment(start, end, 10);
  }

  // Arrival at final destination
  const last = coords[coords.length - 1];
  updateInfoBubble({ lat: last[0], lng: last[1] }, last[2]);
}

function animateDrivingSegment(startCoord, endCoord, speed) {
  return new Promise((resolve) => {
    const router = platform.getRoutingService(null, 8);
    const routingParameters = {
      'routingMode': 'fast',
      'transportMode': 'car',
      'origin': `${startCoord[0]},${startCoord[1]}`,
      'destination': `${endCoord[0]},${endCoord[1]}`,
      'return': 'polyline'
    };

    router.calculateRoute(routingParameters, (result) => {
      if (result.routes.length) {
        const section = result.routes[0].sections[0];
        const lineString = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const points = [];
        
        lineString.eachLatLngAlt((lat, lng) => {
          points.push({ lat, lng });
        });

        growLine(points, speed, resolve);
      } else {
        console.warn("No route found between", startCoord[2], "and", endCoord[2]);
        resolve();
      }
    }, (error) => {
      console.error("Routing Error:", error);
      resolve();
    });
  });
}

function growLine(points, speed, onComplete) {
  let i = 0;
  const animatedLineString = new H.geo.LineString();
  const polyline = new H.map.Polyline(animatedLineString, {
    style: { lineWidth: 4, strokeColor: 'rgba(0, 128, 255, 0.8)' }
  });
  map.addObject(polyline);

  function animate() {
    if (i < points.length) {
      animatedLineString.pushPoint(points[i]);
      polyline.setGeometry(animatedLineString);
      map.setCenter(points[i]); 
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
    content: `<div style="padding:5px 10px; font-weight:bold; font-size:14px;">${text}</div>`
  });
  ui.addBubble(currentBubble);
}

// Start the sequence
startJourney();