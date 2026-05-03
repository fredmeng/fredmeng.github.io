// 1. MAP INITIALIZATION
const platform = new H.service.Platform({
    apikey: window.apikey || 'YOUR_HERE_API_KEY'
});

const defaultLayers = platform.createDefaultLayers({ lg: 'zh' });
const initialCenter = { lat: coords[0][0], lng: coords[0][1] };

const map = new H.Map(document.getElementById('map'),
    defaultLayers.vector.normal.map, {
        center: initialCenter,
        zoom: 14,
        pixelRatio: window.devicePixelRatio || 1
    });

// Enable interactions and UI
const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
const ui = H.ui.UI.createDefault(map, defaultLayers);

window.addEventListener('resize', () => map.getViewPort().resize());

/**
 * Core Animation Function
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

            // 1. Determine target zoom based on distance
            const targetZoom = segmentDist > 50 ? 8 : 14;

            // 2. Completion Listener: Only draws the line AFTER the map settles
            const onAnimationFinished = (evt) => {
                if (evt.target.getAnimationState() === H.Map.AnimationState.END) {
                    // Remove listener immediately so it doesn't fire again
                    map.removeEventListener('animationstatechange', onAnimationFinished);

                    // 3. Draw the line now that we are at the correct zoom/position
                    const lineString = new H.geo.LineString();
                    lineString.pushPoint(start);
                    lineString.pushPoint(end);

                    const polyline = new H.map.Polyline(lineString, {
                        style: { lineWidth: 5, strokeColor: 'rgba(0, 128, 255, 0.8)' }
                    });
                    map.addObject(polyline);

                    // 4. Update Info Bubbles
                    handleBubbles(end, locationName, prevLocationName, index === coords.length - 2);

                    // 5. Move to next point after the specified delay
                    index++;
                    setTimeout(drawNextSegment, delay);
                }
            };

            // Attach listener and trigger the camera movement
            map.addEventListener('animationstatechange', onAnimationFinished);
            
            map.getViewModel().setLookAtData({
                position: end,
                zoom: targetZoom
            }, true);
        }
    }

    /**
     * Helper to manage InfoBubbles
     */
    function handleBubbles(end, name, prevName, isLast) {
        if (isLast) {
            if (bubble) ui.removeBubble(bubble);
            const finalBubble = new H.ui.InfoBubble(end, {
                content: `<div style="font-weight:bold; padding:10px; font-size:14px; color:#007bff;">
                            🏁 Total Journey: ${totalDistance.toFixed(1)} km
                          </div>`
            });
            ui.addBubble(finalBubble);
            finalBubble.open();
        } else if (name && name !== prevName) {
            // Only swap bubbles if the location name actually changes (city to city)
            if (bubble) ui.removeBubble(bubble);
            bubble = new H.ui.InfoBubble(end, {
                content: `<div style="font-weight:bold; padding:5px;">${name}</div>`
            });
            ui.addBubble(bubble);
            bubble.open();
        }
    }

    // Show initial starting point
    if (coords[0] && coords[0][2]) {
        bubble = new H.ui.InfoBubble({ lat: coords[0][0], lng: coords[0][1] }, {
            content: `<div style="font-weight:bold; padding:5px;">${coords[0][2]}</div>`
        });
        ui.addBubble(bubble);
        bubble.open();
    }

    drawNextSegment();
}

/**
 * Harversine Distance Formula (km)
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

// UI Trigger
document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("start-btn").style.display = "none";
    
    // Play music if exists
    const music = document.getElementById("bg-music");
    if (music) {
        music.volume = 0.3;
        music.play().catch(() => console.log("Audio blocked by browser."));
    }

    drawLinesSequentially(coords);
});