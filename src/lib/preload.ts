import { CONTENT } from '../content/site'
import { CAROUSEL_BACK_TEXTURE, STAR_FILES } from '../ui/WorldContent'

/**
 * Every image the site loads OUTSIDE THREE's texture pipeline — plain
 * `<img src=...>` tags in WorldContent.tsx (project screenshots, the papers
 * grid, the hub's floating photo, the in-silico microbe floaters, the
 * falling stars). drei's useProgress only sees useTexture() calls, so these
 * are invisible to it — which is exactly why the loading screen used to
 * disappear while these were still arriving mid-scroll. LoadingScreen.tsx
 * preloads this list itself and waits for all of it, on top of useProgress.
 */
export function domImageUrls(): string[] {
  const urls = new Set<string>([CAROUSEL_BACK_TEXTURE, ...STAR_FILES.map((f) => `/items/stars/${f}`)])
  for (const world of Object.values(CONTENT)) {
    const intro = world.intro
    if (!intro) continue
    if (intro.floater) urls.add(intro.floater)
    for (const p of intro.projects ?? []) {
      if (p.gif) urls.add(p.gif)
      for (const f of p.floaters ?? []) urls.add(f)
    }
    for (const paper of intro.papers ?? []) urls.add(paper.image)
  }
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
