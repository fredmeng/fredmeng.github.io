// 2. MAP INITIALIZATION
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

const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
const ui = H.ui.UI.createDefault(map, defaultLayers);

window.addEventListener('resize', () => map.getViewPort().resize());

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

            // --- ATOMIC VIEW UPDATE ---
            // Determine target zoom: 8 for long jumps, 14 for city movement
            const targetZoom = segmentDist > 50 ? 8 : 14;

            // setLookAtData changes center and zoom in one single animation frame
            map.getViewModel().setLookAtData({
                position: end,
                zoom: targetZoom
            }, true); // 'true' enables smooth animation

            // --- DRAW POLYLINE ---
            const lineString = new H.geo.LineString();
            lineString.pushPoint(start);
            lineString.pushPoint(end);

            const polyline = new H.map.Polyline(lineString, {
                style: { lineWidth: 5, strokeColor: 'rgba(0, 128, 255, 0.8)' }
            });
            map.addObject(polyline);

            // --- BUBBLE LOGIC ---
            const isLast = (index === coords.length - 2);
            if (isLast) {
                if (bubble) ui.removeBubble(bubble);
                const finalBubble = new H.ui.InfoBubble(end, {
                    content: `<div style="font-weight:bold; padding:10px;">Total Journey: ${totalDistance.toFixed(1)} km</div>`
                });
                ui.addBubble(finalBubble);
                finalBubble.open();
            } else {
                if (bubble) ui.removeBubble(bubble);
                if (locationName && locationName !== prevLocationName) {
                    bubble = new H.ui.InfoBubble(end, {
                        content: `<div style="font-weight:bold; padding:5px;">${locationName}</div>`
                    });
                    ui.addBubble(bubble);
                    bubble.open();
                }
            }

            index++;
            
            // Give extra time for the map to finish a massive jump zoom before the next move
            const nextDelay = segmentDist > 50 ? 1500 : delay;
            setTimeout(drawNextSegment, nextDelay);
        }
    }

    if (coords[0][2]) {
        bubble = new H.ui.InfoBubble({ lat: coords[0][0], lng: coords[0][1] }, {
            content: `<div style="font-weight:bold; padding:5px;">${coords[0][2]}</div>`
        });
        ui.addBubble(bubble);
        bubble.open();
    }

    drawNextSegment();
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("start-btn").style.display = "none";
    drawLinesSequentially(coords);
});