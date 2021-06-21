import CardInfo from  '../../CardData';
import Scape_Back from '../../res/scape_back_logo.png'


const rules = {
  START_OF_GAME: [
    "Each player places all ancients in a pile outside the game",
    "Each player Shuffles their deck and presents to opponent for cutting", 
    "Each player draws 7 cards",
    "Each player looks at their hands; then each player selects and starts with an Ancient in play.",
    "Each player starts the game with 25 Will-Power.",
    "NO MULLIGANS (Hint: select Field of imagination if you do not like your hand)",
    "players do not draw cards on the starting players turn."
  ],
  PHASES_OF_TURN: [
    "Replenish: all landscapes and beings are unexhausted.",
    "Draw: Each player draws a card.",
    "Play: play any being spells.",
    "Combat: pre-combat → declare attackers → blocks → pre-damage → resolve damage.",
    "Play:  play any being spells.",
    "End: respond to any game actions or player abilities on the stack."
  ],
  DURING_PLAY_PHASE: [
    "During your turn you may play landscapes equal to the turn number. With no more than three landscapes per turn maximum.",
    "EACH player draws a card on each turn.",
    "You may only cast non-being spells with Will-Power",
    "Beings may attack the first turn played",
    "You can only cast being spells by exauhsting landscapes",
    "If you have not played a landscape in 3 consecutive turns, you may search for a landscape and play it harvested on your end step.(players must keep physical evidence of the count)",
    "If you have not casted a spell for 3 consecutive turns, you may draw a card on your next replenish step..(players must keep physical evidence of the count)"
  ],
  COMBAT_PHASE: [
    "Unblocked beings deal multiplicative damage/ or additive damage upon damage resolution as decided by the attacking player."
  ],
  GENERAL: [
    "You may cast non-being spells anytime, and only with Will-Power.",
    "All non-being spells can be played anytime a player has priority.",
    "You may cast being only by exauhsting landscapes.",
    "You may sacrifice landscapes anytime.",
    "Sacrifice/Harvest a landscape: gain 1 Will-Power. (you may do this as a response, and it cannot be responded to as an action and does not use the stack)",
    "You may discard 3 cards and draw a card anytime",
    "All landscapes and Will-Power are the same non-color.",
    "You may sacrifice two permanents of the same type any time to draw a card.",
    "Ancients cannot be harvested only Sacrificed.",
    "Exile cancel from your hand and pay its cost: reselect an ancient.",
    "A player may not respond to an Ancient ability activation.",
    "You may exhaust a landscape and sacrifice the same landscape in a single turn.",
    "Sacrificing beings is an activated ability and can be responded to.",
  ],

  HOW_TO_WIN: [
    "Your opponent does not have any landscapes in play at their end step.",
    "Your opponent’s Will-Power has been reduced to below 1",
    "When the 10th landscape enters play under your control. (this action cannot be responded to)",
    "At the beginning of your turn: You control one of each permanent and have one of each spell type in your yard.",
    "You have sacrificed Field of Imagination for the 5th time (this action cannot be responded to).",
    "At your end step, there are no more cards in your deck."
  ],

  CASTING: [
    "You may cast a being for its power by exhausting landscapes equal to that beings power.",
    "[being_flyer] may be cast by: Exhausting 3 landscapes.Exhausting 2 landscapes and discarding a card as an additional cost.Exhausting 2 landscapes and sacrificing a landscape as an additional cost.",
    "All spells may be cast by paying will-power equal to the number of dots on the card.",
    "For each Grow casted in a single turn that player must pay the original cost of Grow multiplied by the number of times played within that turn.",
    "Ignite deals cumulative damage for each copy on the stack, adding +1 damage for each copy upon resolution of the stack."
  ],

  RITUAL: [
    "Stack rituals may be crafted anytime a stack exists. Action rituals may only be used on your turn."
  ],

  PLAYER_RITUALS: 
  [
    "CULTIVATE: You may, during your play phase, sacrifice any amount of beings with power equal to a being in your yard to cast a being from your yard with equal power, but cannot attack on the turn it was summoned. It comes into play exhausted.",
    "STUDY: You may cast a spell from your yard by sacrificing beings or landscapes equal to a power of a spell in your yard. The casting player takes double damage in will-power equal to the chosen spells power. remove the spell from the game.",
    "EVOLVE: You may, during your play phase, spend Will-Power equal to or less than the number of landscapes you control, and transform one of your landscapes into a being with stats WP/WP-2.",
    "NOURISH: You may sacrifice a being during your play phase in order to return a landscape to your hand from the yard.",
    "FINAL BLOW: If two players both have below 1 will power in the same moment, priority switches. The player to put the last card on the stack will win.",
    "LAST BREATH: if you have 10 or more cards in your yard, you may exile all cards and set your life total to 1.",
    "STACK WAR: If there are more than 4 cards on the stack, whomever plays the last card on the stack and after the stack resolves, draws a card.",
  ],

  STACK_RITUALS: [
    "cancel /cancel/spike: (+2) damage from spike (casting player does not take damage from the casted cancel)",
    "being 5/spike/grow: (create a [being 2])",
    "ignite/ignite/grow: (destroy target players non-ancient landscape)",
    "flyer/cancel/ignite: (create a 3/1 flyer)",
    "grow/grow(controlled by different players): negates reselecting an ancient.",
    "grow/cancel: Each player draws a card."
  ],

  ACTION_RITUALS: [
    "landscape/landscape/ignite/[being_2]: +1 damage from ignite",
    "landscape/landscape/being one /being one/ ignite: (+1 damage ignite)",
    "sac ancient/ sac two landscapes:	draw three cards, discard a card.",
    "if there are 3 beings of the same name and you may cast ignite/spike(deals damage to all, but one target being of the same name).",
    "sacrifice two flyers: gain control of target being, draw a card.",
    "if you have 5 or more cards in your yard/cancel: exile target players’ yard."
  ],


  CARDS: [
    CardInfo.nest_of_swarm.name+" (Ancient)" +" :: "+CardInfo.nest_of_swarm.text,
    CardInfo.misty_isle.name+" (Ancient)" +" :: " +CardInfo.misty_isle.text,
    CardInfo.smoldering_volcano.name+" (Ancient)" + " :: " + CardInfo.smoldering_volcano.text,
    CardInfo.cavern_of_the_see.name+" (Ancient)" + " :: " + CardInfo.cavern_of_the_see.text,
    CardInfo.field_of_imagination.name+" (Ancient)" + " :: "+ CardInfo.field_of_imagination.text,
    CardInfo.landscape.name+ " :: "+ CardInfo.landscape.text,
    CardInfo.spike.name + "(3)" + " :: " + CardInfo.spike.text,
    CardInfo.cancel.name + "(3)" + " :: " +CardInfo.cancel.text,
    CardInfo.ignite.name +"(1)"+ " :: " + CardInfo.ignite.text,
    CardInfo.grow.name + "(3)"+ " :: "+ CardInfo.grow.text,
    CardInfo.being_one.name+ "(1/1)" + " :: " + CardInfo.being_one.text,
    CardInfo.being_two.name+ "(2/2)" + " :: " + CardInfo.being_two.text,
    CardInfo.being_three.name + "(3/3)"+ " :: " + CardInfo.being_three.text,
    CardInfo.being_four.name + "(4/4)"+ " :: " + CardInfo.being_four.text ,
    CardInfo.being_five.name+ "(5/5)" + " :: " + CardInfo.being_five.text,
    CardInfo.being_flying.name+ "(2/3)" + " :: " + CardInfo.being_flying.text,








  ],

  DECK_TO_MTG:[
    "24X Forest *landscape",
    "4x Willow Elf or Fugitive Wizard (1/1)",
    "4x Cylian Elf (2/2)",
    "4x Centaur Courser (3/3)",
    "4x Rumbling Baloth (4/4)",
    "4x Hollowhenge Beast (5/5)",
    "4x Oko's Accomplices (2/3) *flyer",
    "4x Shock (1) *ignite",
    "4x Cancel (3)",
    "4x Natural Connection (3) *grow",
    "4x Flame Lash (4) *spike",
    "5X Ancients  *draw your own ;)"

  ],

  PROXY_IMAGES: [
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=524956&type=card",
    "https://product-images.tcgplayer.com/fit-in/400x558/11041.jpg",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=174935&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=466922&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=489409&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=262868&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=475928&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=517594&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=485369&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=482812&type=card",
    "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=489506&type=card",
    Scape_Back,
  










  ]


 

};






export default rules;
