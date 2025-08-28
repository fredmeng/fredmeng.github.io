window.onload = function() {
  // Play background music
  var music = document.getElementById("bg-music");
  music.volume = 0.3; // Set volume to 30%
  music.play().catch((e) => {
    console.log("Autoplay blocked. Waiting for user interaction.");
  });

  // Draw lines after a short delay
  setTimeout(() => {
    drawLinesSequentially(coords, 700);
  }, 1000);
};
