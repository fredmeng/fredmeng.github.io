// 2. MAP INITIALIZATION
const platform = new H.service.Platform({
    apikey: window.apikey || 'YOUR_HERE_API_KEY' // Set window.apikey in your HTML or replace here
});

// Configure layers to use Chinese labels
const defaultLayers = platform.createDefaultLayers({ lg: 'zh' });

// Center map on the first point in the dataset immediately
const initialCenter = { lat: coords[0][0], lng: coords[0][1] };

const map = new H.Map(document.getElementById('map'),
    defaultLayers.vector.normal.map, {
        center: initialCenter,
        zoom: 10,
        pixelRatio: window.devicePixelRatio || 1
    });

// Enable interactions and default UI
const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
const ui = H.ui.UI.createDefault(map, defaultLayers);

// Resize listener
window.addEventListener('resize', () => map.getViewPort().resize());

/**
 * Core Animation Function
 * @param {Array} coords - The array of coordinates
 * @param {Number} delay - Milliseconds between segments
 */
function drawLinesSequentially(coords, delay = 800) {
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
            // Automatically adjust zoom based on the length of the travel leg
            if (segmentDist < 5) {
                map.setZoom(14, true); 
            } else if (segmentDist > 50) {
                map.setZoom(8, true);
            }

            const lineString = new H.geo.LineString();
            lineString.pushPoint(start);
            lineString.pushPoint(end);

            const polyline = new H.map.Polyline(lineString, {
                style: { lineWidth: 5, strokeColor: 'rgba(0, 128, 255, 0.8)' }
            });
            
            map.addObject(polyline);
            map.setCenter(end, true);

            const isLast = (index === coords.length - 2);

            if (isLast) {
                // Final persistent bubble showing total distance
                const finalBubble = new H.ui.InfoBubble(end, {
                    content: `<div style="font-weight:bold; padding:10px; font-size:14px; color:#007bff;">
                                Total Journey: ${totalDistance.toFixed(1)} km
                              </div>`
                });
                ui.addBubble(finalBubble);
            } else {
                // Clean up previous transient bubble
                if (bubble) ui.removeBubble(bubble);

                // --- ANTI-FLICKER LOGIC ---
                // Only create a new bubble if the name has changed (e.g. moving between cities)
                if (locationName && locationName !== prevLocationName) {
                    bubble = new H.ui.InfoBubble(end, {
                        content: `<div style="font-weight:bold; padding:5px;">${locationName}</div>`
                    });
                    ui.addBubble(bubble);
                }
            }

            index++;
            setTimeout(drawNextSegment, delay);
        }
    }

    // Show initial bubble for the starting point
    if (coords[0][2]) {
        bubble = new H.ui.InfoBubble({ lat: coords[0][0], lng: coords[0][1] }, {
            content: `<div style="font-weight:bold; padding:5px;">${coords[0][2]}</div>`
        });
        ui.addBubble(bubble);
    }

    drawNextSegment();
}

/**
 * Harversine Distance Formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * UI Event Listeners
 */
document.getElementById("start-btn").addEventListener("click", () => {
    const music = document.getElementById("bg-music");
    
    if (music) {
        music.volume = 0.3; // Balanced background volume
        music.play().then(() => {
            console.log("Audio playback started.");
        }).catch((err) => {
            console.warn("Audio blocked by browser. Interaction required.", err);
        });
    }

    // Hide UI button and initiate drawing
    document.getElementById("start-btn").style.display = "none";
    drawLinesSequentially(coords);
});