/**
 * ui.js
 * Handles the mobile navigation menu toggle
 */
function navMenu() {
    var x = document.getElementById("nav-links");
    // Toggle the display style
    if (x.style.display === "block") {
        x.style.display = "none";
    } else {
        x.style.display = "block";
    }
}