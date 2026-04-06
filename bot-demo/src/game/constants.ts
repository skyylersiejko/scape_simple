import type { CardDef } from '../types';

const CARD_IMAGE_BASE = `${import.meta.env.BASE_URL}cards/`;

export const CARD_DEFS: Record<string, CardDef> = {
  // Ancients
  'nest_of_swarm': {
    id: 'nest_of_swarm', name: 'Nest of Swarm', type: 'ancient', isAncient: true,
    description: 'Create two 1/1 Insect being Tokens.',
    imageUrl: `${CARD_IMAGE_BASE}nest_of_swarm.png`
  },
  'misty_isle': {
    id: 'misty_isle', name: 'Misty Isle', type: 'ancient', isAncient: true,
    description: 'Prevent all damage until end of turn.',
    imageUrl: `${CARD_IMAGE_BASE}misty_isle.png`
  },
  'smoldering_volcano': {
    id: 'smoldering_volcano', name: 'Smoldering Volcano', type: 'ancient', isAncient: true,
    description: 'Deal 3 damage to any target.',
    imageUrl: `${CARD_IMAGE_BASE}smoldering_volcanoe.png`
  },
  'cavern_of_the_see': {
    id: 'cavern_of_the_see', name: 'Cavern of the See', type: 'ancient', isAncient: true,
    description: "Look at target player's hand. Select a card and have them recycle it.",
    imageUrl: `${CARD_IMAGE_BASE}cavern_of_the_see.png`
  },
  'field_of_imagination': {
    id: 'field_of_imagination', name: 'Field of Imagination', type: 'ancient', isAncient: true,
    description: 'RECYCLE: Shuffle your hand into your deck and draw that many cards.',
    imageUrl: `${CARD_IMAGE_BASE}field_of_imagination.png`
  },

  // Landscape
  'landscape': {
    id: 'landscape', name: 'Landscape', type: 'landscape',
    description: 'SACRIFICE: Gain 1 Will-Power.',
    imageUrl: `${CARD_IMAGE_BASE}landscape.png`
  },

  // Spells
  'spike': {
    id: 'spike', name: 'Spike', type: 'spell', spellType: 'spike', cost: 3, dots: 3,
    description: 'Deal 4 damage to any target.',
    imageUrl: `${CARD_IMAGE_BASE}spike.png`
  },
  'cancel': {
    id: 'cancel', name: 'Cancel', type: 'spell', spellType: 'cancel', cost: 3, dots: 3,
    description: 'Counter target spell or being.',
    imageUrl: `${CARD_IMAGE_BASE}cancel.png`
  },
  'ignite': {
    id: 'ignite', name: 'Ignite', type: 'spell', spellType: 'ignite', cost: 1, dots: 1,
    description: 'Deal 2 damage to any target.',
    imageUrl: `${CARD_IMAGE_BASE}ignite.png`
  },
  'grow': {
    id: 'grow', name: 'Grow', type: 'spell', spellType: 'grow', cost: 3, dots: 3,
    description: 'Search your deck for a landscape and put it in play exhausted. Choose a new Ancient.',
    imageUrl: `${CARD_IMAGE_BASE}grow.png`
  },

  // Beings
  'insect': {
    id: 'insect', name: 'Insect', type: 'being', power: 1, toughness: 1, cost: 1, dots: 1,
    description: 'Sacrifice or play from your yard as part of a ritual.',
    imageUrl: `${CARD_IMAGE_BASE}being_one.png`
  },
  'merfolk': {
    id: 'merfolk', name: 'Merfolk', type: 'being', power: 2, toughness: 2, cost: 2, dots: 2,
    description: 'Sacrifice or play from your yard as part of a ritual.',
    imageUrl: `${CARD_IMAGE_BASE}being_two.png`
  },
  'pondus': {
    id: 'pondus', name: 'Pondus', type: 'being', power: 3, toughness: 3, cost: 3, dots: 3,
    description: 'Sacrifice or play from your yard as part of a ritual.',
    imageUrl: `${CARD_IMAGE_BASE}being_three.png`
  },
  'cephalodon': {
    id: 'cephalodon', name: 'Cephalodon', type: 'being', power: 4, toughness: 4, cost: 4, dots: 4,
    description: 'Sacrifice or play from your yard as part of a ritual.',
    imageUrl: `${CARD_IMAGE_BASE}being_four.png`
  },
  'shroon': {
    id: 'shroon', name: 'Shroon', type: 'being', power: 5, toughness: 5, cost: 5, dots: 5,
    description: 'Sacrifice or play from your yard as part of a ritual.',
    imageUrl: `${CARD_IMAGE_BASE}being_five.png`
  },
  'wasp': {
    id: 'wasp', name: 'Wasp', type: 'being', power: 2, toughness: 3, cost: 2, dots: 2,
    isFlyer: true,
    description: 'May attack without exhausting. Cannot be blocked by beings without flying.',
    imageUrl: `${CARD_IMAGE_BASE}being_flyer.png`
  },
};

export const STARTING_HAND_SIZE = 7;
export const STARTING_WILL_POWER = 25;
export const MAX_LANDSCAPES_PER_TURN_HARD_CAP = 3;
export const WIN_CONDITION_LANDSCAPES = 10;
export const WIN_CONDITION_FOI_SAC = 5;

// Add evolved being card defs (created by EVOLVE ritual: stats are WP/WP-2)
for (let wp = 1; wp <= 12; wp++) {
  const t = Math.max(1, wp - 2);
  const id = `evolved_${wp}`;
  CARD_DEFS[id] = {
    id,
    name: `Evolved (${wp}/${t})`,
    type: 'being',
    power: wp,
    toughness: t,
    cost: wp,
    dots: Math.min(wp, 5),
    description: `Evolved from a Landscape. ${wp}/${t} being.`,
  };
}

// 3/1 flyer token (created by flyer/cancel/ignite stack ritual)
CARD_DEFS['flyer_token'] = {
  id: 'flyer_token',
  name: 'Storm Flyer',
  type: 'being',
  power: 3,
  toughness: 1,
  cost: 3,
  dots: 3,
  isFlyer: true,
  description: 'Created by the Storm Flyer ritual. Has flying.',
  imageUrl: `${CARD_IMAGE_BASE}being_flyer.png`,
};

export function buildStandardDeck(): string[] {
  const deck: string[] = [];

  for (let i = 0; i < 24; i++) deck.push('landscape');

  for (let i = 0; i < 4; i++) deck.push('insect');
  for (let i = 0; i < 4; i++) deck.push('merfolk');
  for (let i = 0; i < 4; i++) deck.push('pondus');
  for (let i = 0; i < 4; i++) deck.push('cephalodon');
  for (let i = 0; i < 4; i++) deck.push('shroon');
  for (let i = 0; i < 4; i++) deck.push('wasp');

  for (let i = 0; i < 4; i++) deck.push('ignite');
  for (let i = 0; i < 4; i++) deck.push('cancel');
  for (let i = 0; i < 4; i++) deck.push('grow');
  for (let i = 0; i < 4; i++) deck.push('spike');

  return deck;
}

export const ANCIENTS = [
  'nest_of_swarm', 'misty_isle', 'smoldering_volcano',
  'cavern_of_the_see', 'field_of_imagination'
];
