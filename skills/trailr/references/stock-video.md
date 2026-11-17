# Stock video

Read this reference when the brief calls for real footage, b-roll, or stock video. Stock can be combined with animated product UI, type and graphics in any format. For live-action compositing details, also read [Corporate video](corporate-video.md).

## Access routes

| Platform | Preferred route | Without a configured integration |
| --- | --- | --- |
| Pexels | For individual clips, use the public clip page and its offered download link as described below. An existing reviewed MCP or official API integration is also an option. | Web search/page retrieval plus an internet-enabled file download tool can be sufficient; an MCP or an API key is not required. |
| Pixabay | An available, reviewed MCP or the official video API using the user's privately configured API key | Search the public website, inspect the clip page and use its normal download flow. Some downloads may require login. |
| Mixkit | The public clip page and its normal download flow; no official MCP or public API is assumed | Use the public page's offered download link or browser download controls. |

MCPs for Pexels and Pixabay may be community integrations rather than official provider servers. Inspect the integration before using it and do not install one automatically. An API key is not required just to inspect public pages, but website downloads can have login, access or automation limits. Do not claim a route works in the current environment until it has been checked.

If the official page exposes a downloadable MP4, a normal HTTP download is sufficient; otherwise use an available browser to perform the site's download flow. Distinguish a preview rendition from the offered full-resolution download. Do not guess CDN URLs, treat every visible video as licensed stock, or bypass login, CAPTCHA, paywalls or download restrictions. If access is blocked, use another approved source or ask the user to download the selected clip.

## Pexels without a dedicated integration

For an individual clip, try this route before requiring the user to install a connector or configure an API key:

1. Find a suitable Pexels video page with the available web search tool. Open the actual clip page and check its author, license, dimensions and duration.
2. Follow the page's offered **Free download** link. If it redirects to a media URL, use that returned URL. A web-reading tool may report that it cannot display the MP4 while still exposing the redirect target; the file download tool can then try that target. Never manufacture a media URL from a clip ID or from another clip's filename pattern.
3. Download the MP4 into `<output-dir>/stock/` with an internet-enabled file tool, Python or another available HTTP client. A browser is only needed if the site's normal download flow requires browser interaction.
4. Verify that the result is a video rather than an HTML error page. Use `ffprobe` to inspect duration, dimensions, frame rate and audio streams, and add the source record described below before composing it.

Example clip: [Tall Trees in the Forest, clip 6563538](https://www.pexels.com/video/tall-trees-in-the-forest-6563538/). A web tool can expose the public download redirect, and Python can then download the MP4 without an MCP, an API key or login. This does not guarantee every download will behave the same way.

Direct Python requests to Pexels' search/page HTML can return HTTP 403 even when the offered media download works. Use the available web-reading tool or the normal browser flow to obtain the page's link when necessary. Do not describe the entire search-to-download workflow as Python-only, and do not treat a page-fetch failure as proof that a public MP4 download is unavailable. Respect any access restrictions encountered by the download itself.

### What the host needs

This route depends on capabilities: the host needs a way to search/read the web, retrieve the offered download URL, and save an internet-hosted binary file into the working environment. Check that these tools and network access are actually available in the current session; web search alone does not establish file download access. Rendering Trailr's composition additionally needs Playwright, FFmpeg and the other build dependencies checked by `scripts/doctor.js` (see [the main workflow](../SKILL.md#workflow)).

## Select and verify

1. Translate the approved scene into a visual search: subject, action, framing, lighting, camera movement, orientation and approximate length. Search a small candidate set rather than downloading a whole collection.
2. Inspect the selected clip's own page and current license. For Mixkit, distinguish Stock Video Free License from Restricted License; a free download alone does not establish commercial suitability. Check people, logos and implied endorsements against the intended use.
3. Record the provider, clip ID, author, source page, license URL, date checked, chosen rendition and local filename in `<output-dir>/stock/sources.json`. Include required attribution and a short note on any usage restrictions. A media URL by itself is not a license record.
4. Download only the selected usable rendition to `<output-dir>/stock/`. Preserve its original file; make trimmed, cropped or graded derivatives separately. Use the returned official download link, not an invented path. Keep credentials out of commands, logs and delivery records.
5. Inspect the file with `ffprobe`: duration, dimensions, frame rate and audio streams. Review representative frames. A preview that is too small for the composition is not an acceptable substitute for the final asset.

Follow both the content license and API-specific conditions. Pexels' API guidelines require a prominent link to Pexels and request creator credit when possible. Pixabay requests source identification when displaying API search results and documents caching and rate limits. Check current provider documentation rather than relying on remembered quotas or blanket claims about free use.

## Compose and deliver

Trim only the needed segment, adapt framing deliberately for the output aspect ratio, and align the edit to the scene timeline. Mute stock audio unless the brief needs it and its use is covered. For frame-by-frame screenshot rendering, make the footage seekable and wait for the selected frame before capture, or composite the stock background with rendered overlays in FFmpeg; a live-playing HTML video is not deterministic capture.

A tested way to put real footage inside the animation:
1. Extract the clip's frames with FFmpeg as JPEGs at the composition's resolution and frame rate (e.g. `ffmpeg -i clip.mp4 -vf "fps=60,scale=1920:1080" -q:v 2 work/clip/%05d.jpg`).
2. In the page, set an `<img>`'s `src` to the matching frame in every `render(t)` and wait for `img.decode()` before capturing the screenshot.

Watch the layer order: if the clip appears after a layer that covers the screen (for example the white fade of the brand moment), the clip's `<img>` must sit above that layer, or the frame renders blank. With more than one clip, give each its own layer.

Include source links and required credits in the delivery. Include original stock files in the source bundle only when redistribution is permitted for that delivery; otherwise provide the source record and retrieval instructions. Do not ship a general stock collection as part of the skill.

## Provider documentation

- [Pexels API](https://www.pexels.com/api/documentation/) and [content license](https://www.pexels.com/license/)
- [Pixabay API](https://pixabay.com/api/docs/) and [content license summary](https://pixabay.com/service/license-summary/)
- [Mixkit stock video](https://mixkit.co/free-stock-video/) and [licenses](https://mixkit.co/license/)
