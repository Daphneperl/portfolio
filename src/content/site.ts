import type { WorldId } from '../scene/curve'

/**
 * ALL the readable copy for the site lives here — nothing visual, just words.
 * Edit this file to change what each world says; the <WorldContent> overlay
 * renders whatever it finds. Keep it plain so it's easy to update.
 */

export interface Link {
  label: string
  href: string
}

export interface WorldContent {
  /** narrative block: a title banner and/or a set of project entries */
  intro?: {
    heading: string
    /** each string is its own paragraph */
    lines?: string[]
    links?: Link[]
    /** widen the glass banner a bit beyond the default 460px */
    wide?: boolean
    /** image that floats/rises up from behind the panel (top-right), in sync with its fade */
    floater?: string
    /** projects shown (outside the glass) a few scrolls behind the banner */
    projects?: {
      name: string
      blurb: string
      href?: string
      gif?: string
      title?: string
      /** gif aspect ratio "w / h" so the window fits it without cropping */
      aspect?: string
    }[]
  }
}

export const CONTENT: Record<WorldId, WorldContent> = {
  // 00 — Who I Am  ·············································· EDIT ME
  hub: {
    intro: {
      heading: "I'm Daphne!",
      wide: true,
      floater: '/floating-daph.png',
      lines: [
        'A designer, developer, artist and scientist. I love building things, using modern tools to create environments, nostalgic worlds, and help turn complex technical endeavors into captivating visual stories.',
        'Scroll to travel through my world...',
      ],
      links: [
        { label: 'Email', href: 'mailto:tech@citizencafetlv.com' },
        // Add more when you want, e.g.:
        // { label: 'Instagram', href: 'https://instagram.com/...' },
        // { label: 'GitHub', href: 'https://github.com/...' },
      ],
    },
  },

  // 01 — Web Design & Dev
  web: {
    intro: {
      heading: 'Web Design & Dev',
      projects: [
        {
          name: 'junk_is',
          title: 'Galaxy',
          blurb:
            'An open platform for creative leftovers: sketches, fragments, unfinished ideas. A living archive for the beauty of imperfection. MSDes final project.',
          href: 'https://junk-is-amitco.vercel.app/',
          gif: '/junkis.gif',
          aspect: '800 / 492',
        },
        {
          name: 'memory_almost_full',
          title: 'memory_almost_full',
          blurb:
            'Disruptions as a post-digital aesthetic in the age of the AI revolution, reframing human interaction, creativity, and intelligence.',
          href: 'https://memory-almost-full.vercel.app/',
          gif: '/memory.gif',
          aspect: '916 / 480',
        },
      ],
    },
  },

  // 02 — Scientific Graphics
  sci: {
    intro: {
      heading: 'Scientific Graphics',
      lines: [
        'Figures & data viz for micro/neurobiology papers.',
        'Interactive microbiology art exhibition, BGU.',
        'First-author review, Annual Review of Animal Biosciences.',
      ],
    },
  },
}
