import being_one_image from "./res/being_one.png";
import being_two_image from "./res/being_two.png";
import being_three_image from "./res/being_three.png";
import being_four_image from "./res/being_four.png";
import being_five_image from "./res/being_five.png";
import being_flying_image from "./res/being_flying.png";
import  back_image from "./res/scape_back_logo.png";
import cancel_image from "./res/cancel.png";
import ignite_image from "./res/ignite.png";
import grow_image from "./res/grow.png";
import spike_image from "./res/spike.png";
import landscape_image from "./res/landscape.png";
import smoldering_volcano_image from "./res/smoldering_volcanoe.png";
import field_of_imagination_image from "./res/field_of_imagination.png";
import cavern_of_the_see_image from "./res/cavern_of_the_see.png";
import misty_isle_image from "./res/misty_isle.png";
import nest_of_swarm_image from "./res/nest_of_swarm.png";



const Cards = {


    field_of_imagination: {
        name: "Field of Imagination",
        type: "Ancient",
        power:0,
        defense:0,
        text: "RECYCLE: Shuffle your hand into your deck and draw that many cards. ",
        image: field_of_imagination_image,
        rules_name: "field_of_imagination",
        amount: 1,
    },
    cavern_of_the_see: {
        name: "Cavern of the See",
        type: "Ancient",
        power:0,
        defense:0,
        text: "Look at target players hand. Select a card, and have them Recycle the selected card.",
        image: cavern_of_the_see_image,
        rules_name: "cavern_of_the_see",
        amount:1,
    },
    nest_of_swarm: {
        name: "Nest of Swarm",
        type: "Ancient",
        power:0,
        defense:0,
        text: "Create two 1/1 Insect being Tokens.",
        image:nest_of_swarm_image,
        rules_name: "nest_of_swarm",
        amount:1,
    },
    smoldering_volcano: {
        name: "Smoldering Volcano",
        type: "Ancient",
        power:0,
        defense:0,
        text: "Deal 3 damage to any target.",
        image: smoldering_volcano_image,
        rules_name: "smoldering_volcano",
        amount:1,
    },
    misty_isle: {
        name: "Misty Isle",
        type: "Ancient",
        power:0,
        defense:0,
        text: "Prevent all damage until the end of turn.",
        image:misty_isle_image,
        rules_name: "misty_isle",
        amount:1,
    },






    being_one: {
        name: "Insect",
        type: "Being",
        power:1,
        defense:1,
        text: "Sacrifice or play from your yard as part of a ritual.",
        image: being_one_image,
        rules_name: "being_one",
        amount:4,
    },
    being_two: {
        name: "Merfolk",
        type: "Being",
        power:2,
        defense:2,
        text: "Sacrifice or play from your yard as part of a ritual.",
        image: being_two_image,
        rules_name: "being_two",
        amount:4,
    },
    being_three: {
        name: "Pondus",
        type: "Being",
        power:3,
        defense:3   ,
        text: "Sacrifice or play from your yard as part of a ritual.",
        image:being_three_image,
        rules_name: "being_three",
        amount:4,
    },
    being_four: {
        name: "Cephalodon",
        type: "Being",
        power:4,
        defense:4,
        text: "Sacrifice or play from your yard as part of a ritual.",
        image:being_four_image,
        rules_name: "being_four",
        amount:4,
    },
    being_five: {
        name: "Shroon",
        type: "Being",
        power:5,
        defense:5,
        text: "Sacrifice or play from your yard as part of a ritual.",
        image: being_five_image,
        rules_name: "being_five",
        amount:4,
    },
    being_flying: {
        name: "Wasp",
        type: "Being",
        power:2 ,
        defense:3,
        text: "Sacrifice or play from your yard as part of a ritual. may attack without exhausting.cannot be blocked by creatures without flying.",
        image: being_flying_image,
        rules_name: "being_flyer",
        amount:4,
    },

    cancel: {
        name: "Cancel",
        type: "Spell",
        power:3,
        defense:0,
        text: "Counter target spell or being.",
        image:cancel_image,
        rules_name: "cancel",
        amount:4,
    },
    ignite: {
        name: "Ignite",
        type: "Spell",
        power:2,
        defense:0,
        text: "Deal 2 damage to any target.",
        image: ignite_image,
        rules_name: "ignite",
        amount:4,
    },
    grow: {
        name: "Grow",
        type: "Spell",
        power:3,
        defense:0,
        text: "Search your deck for a landscape and put it in play exhausted. Choose a new Ancient",
        image: grow_image,
        rules_name: "grow",
        amount:4,
    },
    spike: {
        name: "Spike",
        type: "Spell",
        power:4,
        defense:0,
        text: "Deal 4 damage to any target.",
        image:spike_image,
        rules_name: "spike",
        amount:4,
    },

    landscape: {
        name: "Landscape",
        type: "Landscape",
        power:0,
        defense:0,
        text: "SACRIFICE: gain 1 will power.",
        image:landscape_image,
        rules_name: "landscape",
        amount:24,
    },








}


export default Cards;