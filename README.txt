BURRITO RADAR — iPHONE WEB APP

WHAT THIS IS
A small installable web app that searches OpenStreetMap for mapped restaurant/cafe/fast-food points within a 10-mile straight-line radius of an entered address, city, or ZIP code. It sorts by distance and links to directions and a web search for the menu.

IMPORTANT LIMITATIONS
- This is a deployable starter PWA, not an App Store app.
- Search coverage depends on OpenStreetMap data and is not exhaustive.
- It cannot verify that every listed place currently serves burritos, menu items, live opening status, or customer ratings. Always verify before travelling.
- It uses public Nominatim and Overpass services. Their availability/rate limits can change. For a public app with many users, replace these with a suitable commercial API/backend and follow the providers' terms.
- The scheduled weekly Burrito Radar scan in ChatGPT is separate from this app.

EASIEST WAY TO PUT IT ON YOUR IPHONE (GitHub Pages)
1. On a computer, sign in to GitHub and create a new public repository named burrito-radar.
2. Upload all files in this folder to the repository root (index.html, app.js, styles.css, manifest.webmanifest, sw.js, icon.svg, README.txt).
3. In the repository, open Settings > Pages.
4. Under Build and deployment, select Deploy from a branch; choose main and /(root), then Save.
5. Wait for GitHub Pages to publish the site. It will show a URL like https://YOUR-USERNAME.github.io/burrito-radar/ .
6. Open that HTTPS URL in Safari on your iPhone.
7. Tap Share (the square with the upward arrow) > Add to Home Screen. If offered, enable Open as Web App, then tap Add.
8. Launch Burrito Radar from the new Home Screen icon.

You can also host the files on another static HTTPS host. PWA installation/service workers require HTTPS (localhost is an exception).

NO API KEY IS INCLUDED OR REQUIRED IN THIS PROTOTYPE.
