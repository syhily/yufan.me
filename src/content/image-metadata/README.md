# Committed image metadata

Sidecar JSON for `https://cat.yufan.me/...` images is stored here, mirroring the URL path:

- Image: `https://cat.yufan.me/images/2025/12/foo.jpg`
- Metadata file: `src/content/image-metadata/images/2025/12/foo.jpg.json`

Populate or refresh files after adding/changing remote images in content:

```bash
npm run image:metadata:sync
```

Only raster/vector image URLs (e.g. `.jpg`, `.png`, `.webp`) are synced; other paths on the asset host (such as `.pdf`) are skipped.

If the CDN returns 404 for a broken image link but you still want a successful exit code (e.g. local cleanup later), run:

```bash
npm run image:metadata:sync -- --continue-on-error
```

To temporarily allow the build to fetch missing metadata from the CDN (not recommended for CI), set:

```bash
IMAGE_METADATA_REMOTE_FALLBACK=1
```
