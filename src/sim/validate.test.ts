import { expect, test } from 'vitest';
import { cornerShop } from '../../maps/corner-shop';
import { ASSETS } from '../../catalog/assets';
import type { MapDef } from './map';
import { releasableIds, validateMap, type ReleasedIds } from './validate';
import RELEASED from '../../maps/released-ids.json';

const clone = (): MapDef => structuredClone(cornerShop);
const messages = (m: MapDef, released: string[] = [], retired: string[] = []) =>
  validateMap(m, ASSETS, { released, retired } satisfies ReleasedIds).map((p) => `${p.id}: ${p.message}`);

test('Map 1 is valid, and the validator catches every kind of broken map', () => {
  expect(messages(cornerShop, releasableIds(cornerShop))).toEqual([]);

  // a retired id may be missing, but may never come back
  const { released, retired } = RELEASED['corner-shop'];
  expect(retired).toContain('shelf_cap');
  expect(messages(cornerShop, released, retired)).toEqual([]);
  expect(messages(cornerShop, released)).toContain('shelf_cap: was released and must not be removed or renamed');
  const revived = clone();
  revived.upgrades.shelf_cap = { ...revived.upgrades.stack_cap, name: 'Shelf size' };
  expect(messages(revived, released, retired)).toContain('shelf_cap: was retired and must never come back');

  const dangling = clone();
  dangling.pads.egg_shelf.requires = ['tomato_bedd'];
  dangling.upgrades.player_speed.requires = ['stack_cap:9'];
  expect(messages(dangling)).toContain('egg_shelf: requires unknown id "tomato_bedd"');
  expect(messages(dangling)).toContain('player_speed: requires level 9 of "stack_cap", which has 4 levels');

  const cycle = clone();
  cycle.pads.register.requires = ['exit'];
  expect(messages(cycle)).toContain('register: can never be unlocked (cycle or unreachable requirement)');
  expect(messages(cycle)).toContain('exit: can never be unlocked (cycle or unreachable requirement)');

  const unsold = clone();
  delete unsold.pads.oven;
  delete unsold.pads.oven_2;
  unsold.pads.register_2.requires = ['bread_shelf'];
  unsold.pads.stocker_2.requires = ['bread_shelf'];
  unsold.pads.blender_2.requires = ['bread_shelf'];
  unsold.pads.mill_2.requires = ['bread_shelf'];
  unsold.pads.exit.requires = ['mill_2'];
  delete unsold.upgrades.speed_oven;
  expect(messages(unsold)).toContain('bread_shelf: nothing on this map produces bread');
  expect(messages(unsold, releasableIds(cornerShop))).toContain(
    'oven: was released and must not be removed or renamed',
  );

  const crowded = clone();
  crowded.layout.places.egg_shelf.box = [6.25, 7.5, 3, 1];
  crowded.layout.places.ketchup_shelf.box = [13, 19, 3, 1];
  expect(messages(crowded)).toContain('tomato_shelf: overlaps Station egg_shelf');
  expect(messages(crowded).some((m) => m.startsWith('register: Queue Spot') && m.endsWith('ketchup_shelf'))).toBe(true);

  const tight = clone();
  tight.layout.places.egg_shelf.box = [8.5, 7.5, 3, 1];
  expect(messages(tight)).toContain('tomato_shelf: only 0.50 m from egg_shelf (needs 1.5 m)');

  const unknownModel = clone();
  unknownModel.layout.props.prop_sofa.model = 'sofa-deluxe';
  expect(messages(unknownModel)).toContain('sofa-deluxe: model name missing from the asset table');
});
