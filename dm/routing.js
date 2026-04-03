/**
 * routing.js
 */

var platform = new H.service.Platform({
  apikey: window.apikey
});

var defaultLayers = platform.createDefaultLayers();

var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map, {
  center: { lat: coords[0][0], lng: coords[0][1] },
  zoom: 8,
  pixelRatio: window.devicePixelRatio || 1
});

window.addEventListener('resize', () => map.getViewPort().resize());
var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
var ui = H.ui.UI.createDefault(map, defaultLayers);
var currentBubble = null;

async function startJourney() {
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.style.display = 'none';

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];

    updateInfoBubble({ lat: start[0], lng: start[1] }, start[2]);
    await new Promise(r => setTimeout(r, 1000));
    await animateDrivingSegment(start, end, 5); // Speed set to 5ms for smooth driving
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
        // This requires the 'mapsjs-data.js' library!
        const lineString = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const points = [];
        lineString.eachLatLngAlt((lat, lng) => points.push({ lat, lng }));

        growLineSegments(points, speed, resolve);
      } else {
        resolve();
      }
    }, (err) => {
      console.error(err);
      resolve();
    });
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

function navMenu() {
  var x = document.getElementById("nav-links");
  x.style.display = (x.style.display === "block") ? "none" : "block";
}

document.getElementById('start-btn').addEventListener('click', () => {
  const music = document.getElementById('bg-music');
  if (music) {
    music.volume = 0.3;
    music.play().catch(() => console.log("Autoplay blocked"));
  }
  startJourney();
});