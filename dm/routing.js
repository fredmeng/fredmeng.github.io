/**
 * 1. INITIALIZE MAP & SERVICES
 */
var platform = new H.service.Platform({
    apikey: window.apikey // Loaded from /shared/credentials.js
});

var defaultLayers = platform.createDefaultLayers();

// Initialize map centered on the first coordinate in your data
var map = new H.Map(document.getElementById('map'),
    defaultLayers.vector.normal.map, {
        center: { lat: coords[0][0], lng: coords[0][1] },
        zoom: 7,
        pixelRatio: window.devicePixelRatio || 1
    });

// Add basic interactions (Pan/Zoom)
var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
var ui = H.ui.UI.createDefault(map, defaultLayers);
var currentBubble = null;

// Resize listener
window.addEventListener('resize', () => map.getViewPort().resize());

/**
 * 2. CORE ANIMATION LOGIC
 */

async function startJourney() {
    // Hide the start button once clicked
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.style.display = 'none';

    // Loop through each segment of the coordinates array
    for (let i = 0; i < coords.length - 1; i++) {
        const startPoint = coords[i];
        const endPoint = coords[i + 1];

        // Show location bubble
        updateInfoBubble({ lat: startPoint[0], lng: startPoint[1] }, startPoint[2]);

        // Brief pause at each town (1 second)
        await new Promise(r => setTimeout(r, 1000));

        // Calculate route and drive the "car"
        await animateDrivingSegment(startPoint, endPoint, 10);
    }

    // Show bubble for the very last destination
    const lastPoint = coords[coords.length - 1];
    updateInfoBubble({ lat: lastPoint[0], lng: lastPoint[1] }, lastPoint[2]);
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
                console.warn("Route not found between:", startCoord[2], endCoord[2]);
                resolve();
            }
        }, (error) => {
            console.error(error);
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
            
            // Camera follows the line tip
            map.setCenter(points[i]); 

            i++;
            setTimeout(animate, speed);
        } else {
            onComplete();
        }
    }
    animate();
}

/**
 * 3. UI HELPERS
 */

function updateInfoBubble(pos, text) {
    if (currentBubble) ui.removeBubble(currentBubble);
    currentBubble = new H.ui.InfoBubble(pos, {
        content: `<div style="padding:5px 10px; font-weight:bold; font-size:14px; color:black;">${text}</div>`
    });
    ui.addBubble(currentBubble);
}

function navMenu() {
    var x = document.getElementById("nav-links");
    x.style.display = (x.style.display === "block") ? "none" : "block";
}

/**
 * 4. EVENT LISTENERS
 */

// Handle the Start Button Click
document.getElementById('start-btn').addEventListener('click', () => {
    // Start music if blocked by browser autoplay policy
    const music = document.getElementById('bg-music');
    if (music) music.play();
    
    startJourney();
});