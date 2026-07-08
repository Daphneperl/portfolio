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
      /** small gifs that drift/bob around the project window (desktop only) */
      floaters?: string[]
    }[]
    /** papers shown as a sorted 2-row grid a few scrolls behind the banner */
    papers?: {
      title: string
      image: string
      year: number
      href?: string
      /** the image's real width/height ratio, so the grid can size it without cropping */
      aspect: number
    }[]
  }
}

export const CONTENT: Record<WorldId, WorldContent> = {
  // 00 — About Me  ············································· EDIT ME
  hub: {
    intro: {
      heading: "I'm Daphne!",
      wide: true,
      floater: '/floating-daph.png',
      lines: [
        'A designer, developer, artist and scientist.',
        'I love building things, using modern tools to create environments, nostalgic worlds, and help turn complex technical endeavors into captivating visual stories.',
        'Scroll to travel through my world...',
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
        {
          name: 'in-silico-synthesizer',
          title: 'in-silico-synthesizer',
          blurb:
            'Built for a future exhibition exploring microbial worlds — celebrating the invisible universe of bacteria, viruses, and the microbiome. This interactive page is a synthesizer controlled by multiplying microbes, a metaphor for the complex microbial interplay within environments.',
          href: 'https://in-silico.vercel.app/',
          gif: '/in-silico.gif',
          aspect: '800 / 416',
          floaters: [
            '/items/in-silico-gifs/bac1_1.gif',
            '/items/in-silico-gifs/bac1_3.gif',
            '/items/in-silico-gifs/bac2_4.gif',
            '/items/in-silico-gifs/bac3_1.gif',
            '/items/in-silico-gifs/bac4_3.gif',
            '/items/in-silico-gifs/bac5_4.gif',
          ],
        },
      ],
    },
  },

  // 02 — Scientific Graphics
  sci: {
    intro: {
      heading: 'Scientific Graphics',
      lines: [
        "I've got dual masters degrees, in biology and design.",
        'During my years in research I offered graphic services to labs around the world.',
        'I loved when multiple passions of mine find a single home.',
      ],
      // Rendered as a sorted-by-year 2x5 grid — see WorldContent's PapersGrid.
      papers: [
        {
          title:
            'Plasmids in the human gut reveal neutral dispersal and recombination that is overpowered by inflammatory diseases',
          href: 'https://www.nature.com/articles/s41467-024-47272-x.pdf',
          year: 2024,
          image: '/items/papers/Plasmids.png',
          aspect: 1.2287,
        },
        {
          title: 'Community context reshapes microbial proteomes and reduces functional overlap',
          href: 'https://www.nature.com/articles/s41564-026-02310-w.pdf',
          year: 2026,
          image: '/items/papers/Communityproteome.png',
          aspect: 0.8965,
        },
        {
          title: 'The neural basis of imagination: An evolutionary perspective',
          href: 'https://www.sciencedirect.com/science/article/pii/S014976342600045X',
          year: 2026,
          image: '/items/papers/dmn.png',
          aspect: 1.0141,
        },
        {
          title: 'Endemic within endemics: the microbiota of the Galapagos marine iguanas',
          href: 'https://academic.oup.com/ismecommun/article/6/1/ycag040/8512085',
          year: 2026,
          image: '/items/papers/Iguanas.png',
          aspect: 1.0928,
        },
        {
          title: 'Core rumen microbes are functional generalists that sustain host metabolism and gut ecosystem function',
          href: 'https://www.nature.com/articles/s41559-025-02904-3.pdf',
          year: 2025,
          image: '/items/papers/Core.png',
          aspect: 1.297,
        },
        {
          title:
            'ProFiT-SPEci-FISH: a novel approach for linking plasmids to hosts in complex microbial communities at the single-cell level',
          href: 'https://link.springer.com/article/10.1186/s40168-025-02238-z',
          year: 2025,
          image: '/items/papers/Plasmidmethod.png',
          aspect: 1.1354,
        },
        {
          title: 'Cryptic diversity of cellulose-degrading gut bacteria in industrialized humans',
          href: 'https://www.science.org/doi/10.1126/science.adj9223',
          year: 2024,
          image: '/items/papers/science.png',
          aspect: 1.031,
        },
        {
          title: 'Plasmid-encoded toxin defence mediates mutualistic microbial interactions',
          href: 'https://www.nature.com/articles/s41564-023-01521-9',
          year: 2024,
          image: '/items/papers/plasmidtoxins.png',
          aspect: 0.8171,
        },
        {
          title: 'Micro-scale spatial metagenomics opens a new era in microbiome ecology',
          href: 'https://arc.net/l/quote/kapcetbf',
          year: 2026,
          image: '/items/papers/Micro-scale.png',
          aspect: 0.8848,
        },
        {
          title: 'The evolutionary origins of the Global Neuronal Workspace in vertebrates',
          href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10499063/',
          year: 2023,
          image: '/items/papers/oryan1.png',
          aspect: 1.0888,
        },
      ],
    },
  },
}
