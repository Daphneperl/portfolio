import { CONTENT } from '../content/site'

/**
 * Images needed for the initial hub ("About Me") view specifically — NOT the
 * whole site's assets. useProgress (drei) only tracks useTexture() calls
 * (Background.png, and — now that ImagePile is lazy-mounted, see Scene.tsx —
 * nothing else eagerly), so it's blind to plain `<img src=...>` tags like the
 * hub's floating photo. Waiting for literally every image across every world
 * (project screenshots, the papers grid, the sketch pile, microbe floaters,
 * falling stars) would mean a first-time visitor waits on ~70MB of images
 * belonging to sections they haven't scrolled to yet — everything past the
 * hub still loads the normal, lazy way as you scroll to it.
 */
export function domImageUrls(): string[] {
  const urls = new Set<string>()
  if (CONTENT.hub.intro?.floater) urls.add(CONTENT.hub.intro.floater)
  return [...urls]
}

/** Resolves once the browser has the image (or gives up on it) — errors
 * don't reject, so one broken/missing file can't hang the whole preload. */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

/** Preloads every URL in `domImageUrls()`, reporting progress via `onProgress`
 * (loaded count, total count) as each one settles. */
export async function preloadAllDomImages(onProgress: (loaded: number, total: number) => void): Promise<void> {
  const urls = domImageUrls()
  let loaded = 0
  onProgress(0, urls.length)
  await Promise.all(
    urls.map((url) =>
      preloadImage(url).then(() => {
        loaded += 1
        onProgress(loaded, urls.length)
      }),
    ),
  )
}
