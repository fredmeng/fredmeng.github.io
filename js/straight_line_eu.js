// 1. Initialize with Chinese Language
var platform = new H.service.Platform({
  apikey: window.apikey
});

// Configure the default layers to use Chinese ('zh-CN' or 'zh')
var defaultLayers = platform.createDefaultLayers({
  lg: 'zh' 
});

// Ensure the dataset exists before centering
var initialCenter = { lat: 47.4942, lng: 19.0662 }; // Default fallback (Budapest)
if (coords && coords.length > 0) {
    initialCenter = { lat: coords[0][0], lng: coords[0][1] };
}

var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map, {
    center: initialCenter,
    zoom: 10,
    pixelRatio: window.devicePixelRatio || 1
  });

var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
var ui = H.ui.UI.createDefault(map, defaultLayers);

function drawLinesSequentially(coords, delay = 1000) {
  let index = 0;
  let bubble = null;
  let totalDistance = 0;

  function drawNextSegment() {
    if (index < coords.length - 1) {
      const start = { lat: coords[index][0], lng: coords[index][1] };
      const end = { lat: coords[index + 1][0], lng: coords[index + 1][1] };
      const locationName = coords[index + 1][2];
      const prevLocationName = coords[index][2];

      const segmentDist = calculateDistance(start.lat, start.lng, end.lat, end.lng);
      totalDistance += segmentDist;

      // --- DYNAMIC ZOOM LOGIC ---
      if (segmentDist < 5) {
        map.setZoom(10, true); // Zoom in if points are close
      } else if (segmentDist > 50) {
        map.setZoom(6, true);  // Zoom out if points are far
      }

      const lineString = new H.geo.LineString();
      lineString.pushPoint(start);
      lineString.pushPoint(end);

      const polyline = new H.map.Polyline(lineString, {
        style: { lineWidth: 4, strokeColor: 'rgba(0, 128, 255, 0.7)' }
      });
      
      map.addObject(polyline);
      map.setCenter(end, true);

      const isLast = (index === coords.length - 2);

      if (isLast) {
        const finalBubble = new H.ui.InfoBubble(end, {
          content: `<div style="font-weight:bold; font-size:14px; color: #007bff;">Total Distance: ${totalDistance.toFixed(1)} km</div>`,
          offset: { x: 0, y: -25 }
        });
        ui.addBubble(finalBubble);
      } else {
        if (bubble) ui.removeBubble(bubble);

        // --- UNIQUE NAME LOGIC ---
        // Only show bubble if the name is provided AND different from the previous point
        if (locationName && locationName !== prevLocationName) {
          bubble = new H.ui.InfoBubble(end, {
            content: `<div style="font-weight:bold; font-size:14px;">${locationName}</div>
                      <div style="font-size:12px; color:#555;">Next leg: ${segmentDist.toFixed(1)} km</div>`,
            offset: { x: 0, y: -25 }
          });
          ui.addBubble(bubble);
        }
      }

      index++;
      setTimeout(drawNextSegment, delay);
    }
  }

  // Initial city bubble
  if (coords[0][2]) {
    bubble = new H.ui.InfoBubble({ lat: coords[0][0], lng: coords[0][1] }, {
      content: `<div style="font-weight:bold; font-size:14px;">${coords[0][2]}</div>`,
      offset: { x: 0, y: -25 }
    });
    ui.addBubble(bubble);
  }

  drawNextSegment();
}

// Distance Helper
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c);
}