function drawLinesSequentially2(coords, delay = 700) {
  let index = 0;

  function drawNextSegment() {
    if (index < coords.length - 1) {
      const start = { lat: coords[index][0], lng: coords[index][1] };
      const end = { lat: coords[index + 1][0], lng: coords[index + 1][1] };

      const lineString = new H.geo.LineString();
      lineString.pushPoint(start);
      lineString.pushPoint(end);

      const polyline = new H.map.Polyline(lineString, {
        style: { lineWidth: 4, strokeColor: 'rgba(0, 128, 255, 0.7)' }
      });

      map.addObject(polyline);

      // Pan the map to the new point
      map.setCenter(end, true); // 'true' enables animation

      // Optional: show banner messages
      locationMessages.forEach(loc => {
        if (Math.abs(end.lat - loc.lat) < 0.01 && Math.abs(end.lng - loc.lng) < 0.01) {
          showBannerMessage(loc.message);
        }
      });

      index++;
      setTimeout(drawNextSegment, delay);
    }
  }

  drawNextSegment();
}





function drawLinesSequentially(coords, delay = 500) {
  let index = 0;

  function drawNextSegment() {
    if (index < coords.length - 1) {
      const lineString = new H.geo.LineString();
      lineString.pushPoint({ lat: coords[index][0], lng: coords[index][1] });
      lineString.pushPoint({ lat: coords[index + 1][0], lng: coords[index + 1][1] });

      const polyline = new H.map.Polyline(lineString, {
        style: { lineWidth: 4, strokeColor: 'rgba(0, 128, 255, 0.7)' }
      });

      map.addObject(polyline);
      index++;
      setTimeout(drawNextSegment, delay);
    }
  }

  drawNextSegment();
}

function navMenu() {
  var x = document.getElementById("nav-links");
  if (x.style.display === "block") {
    x.style.display = "none";
  } else {
    x.style.display = "block";
  }
}

function addMarkersAndSetViewBounds() {
  var group = new H.map.Group();
  var pngIcon = new H.map.Icon("https://latitude900.com/shared/pin.png",{size:{w:20,h:20}});

  // add markers to the group
  coords.forEach((el)=> {
    group.addObjects([new H.map.Marker({lat:el[0],lng:el[1]},{icon:pngIcon})]);
  })
  map.addObject(group);

  // get geo bounding box for the group and set it to the map
  map.getViewModel().setLookAtData({
    bounds: group.getBoundingBox()
  });
}


function addMarkerToGroup(group, coordinate, html) {
  var pngIcon = new H.map.Icon("https://latitude900.com/shared/pin.png",{size:{w:20,h:20}});
  var marker = new H.map.Marker(coordinate,{icon:pngIcon});
  // add custom data to the marker
  marker.setData(html);
  group.addObject(marker);
}

function addInfoBubble(map) {
  var group = new H.map.Group();

  map.addObject(group);

  // add 'tap' event listener, that opens info bubble, to the group
  group.addEventListener('tap', function (evt) {
    // event target is the marker itself, group is a parent event target
    // for all objects that it contains
    var bubble = new H.ui.InfoBubble(evt.target.getGeometry(), {
      // read custom data
      content: evt.target.getData()
    });
    ui.getBubbles().forEach(bubble => ui.removeBubble(bubble));
    // show info bubble
    ui.addBubble(bubble);
  }, false);

  coords.forEach((el)=> {
    addMarkerToGroup(group, {lat:el[0],lng:el[1]},el[2]);
  })

}

function addPolylineAndSetViewBounds(){
  var lineString = new H.geo.LineString();

  coords.forEach((el)=> {
    lineString.pushPoint({lat:el[0],lng:el[1]});
  })

  map.addObject(new H.map.Polyline(
    lineString, { style: { lineWidth: 4 }}
  ));
  
  // get geo bounding box for the group and set it to the map
  map.getViewModel().setLookAtData({
    bounds: lineString.getBoundingBox()
  });
}

function addPolylineToMap(){
  var lineString = new H.geo.LineString();

  coords.forEach((el)=> {
    lineString.pushPoint({lat:el[0],lng:el[1]});
  })

  map.addObject(new H.map.Polyline(
    lineString, { style: { lineWidth: 4 }}
  ));
}

// Initialize communication with the platform
var platform = new H.service.Platform({
  apikey: window.apikey
});
var defaultLayers = platform.createDefaultLayers();

//Initialize a map
var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map,{
  center: {lat:-27.1116044, lng:134.733873},
  zoom: 3,
  pixelRatio: window.devicePixelRatio || 1
});

// add a resize listener to make sure that the map occupies the whole container
window.addEventListener('resize', () => map.getViewPort().resize());

// Make the map interactive
// MapEvents enables the event system
// Behavior implements default interactions for pan/zoom (also on mobile touch environments)
var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
//behavior.disable(H.mapevents.Behavior.WHEELZOOM);
//behavior.disable(H.mapevents.Behavior.PINCH_ZOOM);
//behavior.disable(H.mapevents.Behavior.DBL_TAP_ZOOM);
//behavior.disable(H.mapevents.Behavior.DRAGGING);

// Create the default UI components
var ui = H.ui.UI.createDefault(map, defaultLayers);
