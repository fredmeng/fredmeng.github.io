document.getElementById("start-btn").addEventListener("click", () => {
  // Start background music
  const music = document.getElementById("bg-music");
  music.volume = 0.3;
  music.play().then(() => {
    console.log("Music started");
  }).catch((err) => {
    console.error("Playback failed:", err);
  });

  // Hide the Start button
  document.getElementById("start-btn").style.display = "none";

  // Start drawing lines
  drawLinesSequentially(coords, 700); // or your preferred function
});