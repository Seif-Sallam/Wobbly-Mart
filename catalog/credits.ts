// The one credits list: feeds the in-game Credits screen and generates CREDITS.md (`npm run credits`).
export interface Credit {
  what: string;
  author: string;
  license: 'CC0' | 'CC-BY 3.0' | 'CC-BY 4.0' | 'OFL 1.1';
  url: string;
}

const kenney = (pack: string, slug: string): Credit => ({
  what: `${pack} (3D/audio pack)`,
  author: 'Kenney',
  license: 'CC0',
  url: `https://kenney.nl/assets/${slug}`,
});

export const CREDITS: Credit[] = [
  kenney('Mini Market', 'mini-market'),
  kenney('Mini Characters', 'mini-characters'),
  kenney('Cube Pets', 'cube-pets'),
  kenney('Food Kit', 'food-kit'),
  kenney('Nature Kit', 'nature-kit'),
  kenney('Furniture Kit', 'furniture-kit'),
  kenney('Fantasy Town Kit', 'fantasy-town-kit'),
  kenney('Car Kit', 'car-kit'),
  kenney('Survival Kit', 'survival-kit'),
  kenney('Platformer Kit', 'platformer-kit'),
  kenney('Interface Sounds', 'interface-sounds'),
  kenney('Impact Sounds', 'impact-sounds'),
  kenney('Music Jingles', 'music-jingles'),
  kenney('Digital Audio', 'digital-audio'),
  kenney('Casino Audio', 'casino-audio'),
  kenney('RPG Audio', 'rpg-audio'),
  kenney('UI Audio', 'ui-audio'),
  {
    what: 'Chicken imitation (cluck)',
    author: 'esperar',
    license: 'CC0',
    url: 'https://freesound.org/people/esperar/sounds/170808/',
  },
  {
    what: 'Mooing Cows (moo)',
    author: 'Hitrison',
    license: 'CC0',
    url: 'https://freesound.org/people/Hitrison/sounds/184831/',
  },
  {
    what: 'Single Goat Bleating 2x (bleat)',
    author: 'Kinoton',
    license: 'CC0',
    url: 'https://freesound.org/people/Kinoton/sounds/581240/',
  },
  {
    what: 'wood creaks (press)',
    author: 'seth-m',
    license: 'CC0',
    url: 'https://freesound.org/people/seth-m/sounds/269722/',
  },
  {
    what: 'Mill stone grinding corn (grind)',
    author: 'PLukx',
    license: 'CC0',
    url: 'https://freesound.org/people/PLukx/sounds/430589/',
  },
  {
    what: 'Boiling Pot of Water (bubble)',
    author: 'monsterthing',
    license: 'CC0',
    url: 'https://freesound.org/people/monsterthing/sounds/456382/',
  },
  {
    what: 'bubbling hot pot 01 (bubble_mud)',
    author: 'rucisko',
    license: 'CC0',
    url: 'https://freesound.org/people/rucisko/sounds/343744/',
  },
  {
    what: 'Water Churn (slosh)',
    author: 'columbia23',
    license: 'CC0',
    url: 'https://freesound.org/people/columbia23/sounds/396749/',
  },
  {
    what: 'Stand mixer slow buildup (mixer)',
    author: 'Fwughox_Official',
    license: 'CC0',
    url: 'https://freesound.org/people/Fwughox_Official/sounds/747749/',
  },
  {
    what: 'Bouncy Hamster Dancing (Corner Shop music)',
    author: 'cynicmusic',
    license: 'CC0',
    url: 'https://opengameart.org/content/bouncy-hamster-dancing-menu-music',
  },
  {
    what: 'Sicilian sun (Juice Bar music)',
    author: 'Konrad "FeniX" Gadzina',
    license: 'CC-BY 3.0',
    url: 'https://opengameart.org/content/sicilian-sun',
  },
  {
    what: "Gone Fishin' (Dairy Farm music)",
    author: "Memoraphile @ You're Perfect Studio",
    license: 'CC0',
    url: 'https://opengameart.org/content/gone-fishin',
  },
  {
    what: '"The Italian Heist" (Pizza Place music)',
    author: 'Eric Matyas, www.soundimage.org',
    license: 'CC-BY 3.0',
    url: 'https://opengameart.org/content/the-italian-heist-looping',
  },
  {
    what: 'Fredoka (font)',
    author: 'Milena Brandão',
    license: 'OFL 1.1',
    url: 'https://fonts.google.com/specimen/Fredoka',
  },
];
