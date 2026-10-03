// The one credits list: feeds the in-game Credits screen and generates CREDITS.md (`npm run credits`).
export interface Credit {
  what: string;
  author: string;
  license: 'CC0' | 'CC-BY 4.0' | 'OFL 1.1';
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
    what: 'Bouncy Hamster Dancing (music)',
    author: 'cynicmusic',
    license: 'CC0',
    url: 'https://opengameart.org/content/bouncy-hamster-dancing-menu-music',
  },
  {
    what: 'Fredoka (font)',
    author: 'Milena Brandão',
    license: 'OFL 1.1',
    url: 'https://fonts.google.com/specimen/Fredoka',
  },
];
