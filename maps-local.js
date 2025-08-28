// rendering
window.onload = function() {
  // Delay line rendering slightly to ensure markers are visible
  setTimeout(() => {
    drawLinesSequentially(coords, 700); // or use addPolylineToMap()
  }, 1000); // 1-second delay after full load
};
