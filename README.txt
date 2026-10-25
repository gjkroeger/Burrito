BURRITO RADAR — UPDATED IPHONE WEB APP (v2)

WHAT CHANGED
- Faster, narrower OpenStreetMap query aimed at burrito/Mexican/taqueria candidates instead of downloading every nearby restaurant.
- Recent result cache (15 minutes) and geocoding cache (7 days) to make repeat searches faster.
- Request timeouts, clearer errors, and fallback to a second public map endpoint.
- Deduplication and radius filtering remain in place.
- Service-worker cache version bumped so GitHub Pages updates can replace stale files.
- Search option changes no longer trigger a surprise search automatically.

HOW TO UPDATE YOUR EXISTING GITHUB REPOSITORY
1. Extract this ZIP on your computer.
2. Open your existing GitHub repository (burrito-radar) and click Add file > Upload files.
3. Upload/drag the files from this folder into the repository root. If prompted, confirm replacing the existing files. Keep index.html at the root.
4. Commit changes to the main branch.
5. Wait a minute or two for GitHub Pages to redeploy.
6. On your iPhone, fully close Burrito Radar, then open the GitHub Pages URL in Safari and refresh. Launch the Home Screen icon again.
7. If it still shows the old version, remove the Home Screen icon, open the URL in Safari, and add it to Home Screen again. You do not need to create a new repository.

IMPORTANT LIMITATIONS
- This is an installable web app, not an App Store app.
- Results depend on OpenStreetMap coverage and are not exhaustive; menu items, ratings, and open status are not guaranteed.
- It uses public Nominatim and Overpass services. They can still be slow, rate-limited, or temporarily unavailable. This update reduces load and improves caching/fallbacks but cannot guarantee a response from public services.
- Cache lasts 15 minutes for search results and 7 days for geocoding. A recent result cache can be slightly out of date.
- For dependable speed and broader restaurant coverage, use a dedicated business-search API and a small backend that protects API credentials and respects provider terms.
- The separate weekly ChatGPT Burrito Radar scan is not part of this app.
