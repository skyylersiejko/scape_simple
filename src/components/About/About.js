import React from "react";
import "./About.css";


class About extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showVocab: false
    };
  }

  componentDidMount() {
    // console.log(rules);
  }

  

  render() {
    return (
      <div className={"About"}>
        <div className={"Heading"}>What is Scape?</div>
        <div className={"Text"}>
              A new card game; Scape brings all the best aspects of interaction within current TCG(s), but
          with a set-deck and more complex actions. Both Players start with the
          same deck ("think Chess"); it's optimized for better game theory/play.
          Instead of the cards telling you what action to take, the player must
          utilize their Will-Power as a resource and cast spells to perform
          rituals that help build towards your victory. Scape is designed for a
          high competitive ceiling with a low learning floor. With Five ways to
          achieve victory, it is up to the player to decide their fate. Which
          Ancient will you choose to support?
        </div>




        <div className={"Heading"}>Why was Scape Created?</div>
        <div className={"Text"}>
             Scape is different. It's Free to build and play. 
             Scape was created because we feel like other TCG(s) are becoming too unstable and bloated. Most TCG(s) are just too large by way of change due to market driven goals. 
             We wanted to rebuild an engine that was hyper competitive and could support complex, but fair gameplay without the need for a pay wall. 
             As we play-tested this game we realized just how much more efficient, complex, and overall fun Scape started to become. We found ourselves wanting to play Scape more than other TCG(s).
             Another incredible aspect of Scape is that, while the deck doesn't change, the rituals and actions do.
             In other words: we will release new rituals to perform in the game as the development of the game progresses.
             Instead of having a prerelease weekend for new cards; we will have release events for new Rituals.
             we see Ritual based gameplay as the next evolution of competitive card games. 
             The Scape engine is more focused on competition gameplay and is built to support a tournament enviroment.
             We hope to release a digital version of the game soon. (end 2021)


        </div>

        <div style = {{color: "white", fontStyle:"italic", fontWeight: "bold", fontSize:"14px", textAlign:"center", padding:"20px"  }}>"I liked the core engine of Magic, but was tired of seeing the massive amount of capitalism canabalise the games integrity."</div>





        
      </div>
    );
  }
}

export default About;
