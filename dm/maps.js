// --- Map Initialization ---
var platform = new H.service.Platform({
  apikey: window.apikey
});
var defaultLayers = platform.createDefaultLayers();

var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map, {
  center: { lat: -33.8804, lng: 151.1155 },
  zoom: 6,
  pixelRatio: window.devicePixelRatio || 1
});

window.addEventListener('resize', () => map.getViewPort().resize());
var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
var ui = H.ui.UI.createDefault(map, defaultLayers);

// --- New Pin & InfoBubble Logic ---

/**
 * Creates pins for every location in coords and handles click/tap events.
 */
function initInteractiveMarkers() {
  var group = new H.map.Group();
  var pngIcon = new H.map.Icon("https://latitude900.com/shared/pin.png", { size: { w: 20, h: 20 } });

  map.addObject(group);

  // Add 'tap' event listener to the group
  group.addEventListener('tap', function (evt) {
    // 1. Close any existing bubbles first
    ui.getBubbles().forEach(bubble => ui.removeBubble(bubble));

    // 2. Get coordinates and data from the clicked marker
    var coord = evt.target.getGeometry();
    var data = evt.target.getData();

    // 3. Create and add the bubble
    var bubble = new H.ui.InfoBubble(coord, {
      content: `<div style="font-family: sans-serif; padding: 5px; font-weight: bold;">${data}</div>`
    });
    ui.addBubble(bubble);
    
    // Optional: Pan to the pin when clicked
    map.setCenter(coord, true);
  }, false);

  // Loop through coords from data.js
  coords.forEach((el) => {
    var marker = new H.map.Marker({ lat: el[0], lng: el[1] }, { icon: pngIcon });
    
    // Store the location string ("City Name 中文") in the marker
    marker.setData(el[2]);
    group.addObject(marker);
  });

  // Automatically zoom the map to show all pins (NSW, TAS, Taiwan)
  map.getViewModel().setLookAtData({
    bounds: group.getBoundingBox()
  });
}

// --- Menu Helper ---
function navMenu() {
  var x = document.getElementById("nav-links");
  x.style.display = (x.style.display === "block") ? "none" : "block";
}

// Execute the marker logic on load
initInteractiveMarkers();