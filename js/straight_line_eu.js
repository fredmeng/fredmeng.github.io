// 1. MAP INITIALIZATION (Standard)
const platform = new H.service.Platform({
    apikey: window.apikey || 'YOUR_HERE_API_KEY'
});
const defaultLayers = platform.createDefaultLayers({ lg: 'zh' });
const map = new H.Map(document.getElementById('map'), defaultLayers.vector.normal.map, {
    center: { lat: coords[0][0], lng: coords[0][1] },
    zoom: 14,
    pixelRatio: window.devicePixelRatio || 1
});
const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
const ui = H.ui.UI.createDefault(map, defaultLayers);

/**
 * Core Animation Function
 */
async function drawLinesSequentially(coords, delay = 800) {
    let index = 0;
    let bubble = null;
    let totalDistance = 0;

    // Show starting bubble
    if (coords[0][2]) {
        bubble = new H.ui.InfoBubble({ lat: coords[0][0], lng: coords[0][1] }, {
            content: `<div style="font-weight:bold; padding:5px;">${coords[0][2]}</div>`
        });
        ui.addBubble(bubble);
        bubble.open();
    }

    while (index < coords.length - 1) {
        const start = { lat: coords[index][0], lng: coords[index][1] };
        const end = { lat: coords[index + 1][0], lng: coords[index + 1][1] };
        const locationName = coords[index + 1][2];
        const prevLocationName = coords[index][2];

        const segmentDist = calculateDistance(start.lat, start.lng, end.lat, end.lng);
        totalDistance += segmentDist;

        // 1. Determine Zoom
        const targetZoom = segmentDist > 50 ? 8 : 14;

        // 2. Move Camera and WAIT if it's a long jump
        map.getViewModel().setLookAtData({
            position: end,
            zoom: targetZoom
        }, true);

        if (segmentDist > 50) {
            // Pause drawing for 1.5s to let the "flight" finish
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // 3. Draw the Line
        const lineString = new H.geo.LineString();
        lineString.pushPoint(start);
        lineString.pushPoint(end);
        const polyline = new H.map.Polyline(lineString, {
            style: { lineWidth: 5, strokeColor: 'rgba(0, 128, 255, 0.8)' }
        });
        map.addObject(polyline);

        // 4. Handle Bubbles
        if (index === coords.length - 2) {
            if (bubble) ui.removeBubble(bubble);
            const finalBubble = new H.ui.InfoBubble(end, {
                content: `<div style="font-weight:bold; padding:10px;">Total Journey: ${totalDistance.toFixed(1)} km</div>`
            });
            ui.addBubble(finalBubble);
            finalBubble.open();
        } else if (locationName && locationName !== prevLocationName) {
            if (bubble) ui.removeBubble(bubble);
            bubble = new H.ui.InfoBubble(end, {
                content: `<div style="font-weight:bold; padding:5px;">${locationName}</div>`
            });
            ui.addBubble(bubble);
            bubble.open();
        }

        // 5. Standard delay between points
        await new Promise(resolve => setTimeout(resolve, delay));
        index++;
    }
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

// UI Event Listener
document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("start-btn").style.display = "none";
    drawLinesSequentially(coords);
});