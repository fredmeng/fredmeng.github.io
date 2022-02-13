# Interactive Maps utilising HERE Maps JavaScript API

## Get your own maps up and running in 5 minutes (no coding!)

Examples: 
1. https://fredmeng.github.io/visited-countries (Countries/Territories I've Visited)
2. https://fredmeng.github.io/rtw-travel-route/ (RTW Travel Route)

Steps:
1. Create a GitHub account if you don't have one
2. Fork https://github.com/fredmeng/fredmeng.github.io
3. Rename the forked repository to `{your-github-username}.github.io` in Settings.
4. Create an account on https://developer.here.com if you don't have one
5. Sign up for a Freemium plan
6. Create a JavaScript API key and copy it
7. Check the option "Create a trusted domain for your app credentials", insert `{your-github-username}.github.io` and hit the SAVE button.
8. Edit `https://github.com/{your-github-username}/{your-github-username}.github.io/blob/mastercredentials.js`
and replace my apikey with yours from step 6.
9. Edit `https://github.com/{your-github-username}/{your-github-username}.github.io/blob/master/visited-countries/data.js`, update the geolocations list to meet your use case and then save. The data format is `[lat,lng,"country name"],` (with a trailing comma) each line. If the last entry, it should be `[lat,lng,"country name"]` (without the trailing comma).
10. Open `https://{your-github-username}.github.io/visited-countries/` to see your visited countries on a pretty interactive map!
11. (Optional) If you want to embed the new map on your website or blog, here is the code. `<iframe src="https://{your-github-username}.github.io/visited-countries/" width="640" height="480" frameborder="0"></iframe>`
