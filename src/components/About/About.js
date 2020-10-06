import React from "react";
import "./About.css";
import rules from "./Rules";

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

  displayRules() {
    let rules_text = [],
      headers = [],
      result = [];
    Object.values(rules).map((rule) => {
      return rules_text.push(
        <p>
           
          {rule.map((child, index ) => {
            return <li key = {index}>{child}</li>;
          })}
        </p>
      );
    });

    Object.keys(rules).map((rule) => {
      headers.push(<h1 className={"Sub_Title"}>{rule}</h1>);
    });

    for (let i = 0; i < headers.length; i++) {
      result.push(headers[i]);
      result.push(rules_text[i]);
    }

    return result.map((child, index ) => {
      return <div key = {index}>{child}</div>;
    });
  }

  displayVocab() {
    if (this.state.showVocab) {
      return (
        <div className={"Termonology"}>
          <ul>
            <li> Exhaust = "Tap"</li>
            <li> Harvested = "Sac or use"</li>
            <li>
              Ritual = sequence of actions that must occur to create an event
            </li>
            <li> Being = "creature"</li>
            <li> Ancient = "Commander"</li>
            <li> Will-Power (WP) = "life"</li>
            <li> Landscape = "basic land"</li>
            <li> Replenish = "untap and upkeep"</li>
            <li> Yard = "discard pile"</li>
            <li>Recycle = "shuffle your hand into your deck and draw that many cards." </li>
            <li>  / = "add to the stack" or play card with forward order, completing the sequence</li>

          </ul>
          <button
            onClick={(e) => {
              this.setState({ showVocab: !this.state.showVocab });
            }}
            className={"VocabBtn"}
          >
            {"Hide Terminology"}
          </button>
        </div>
      );
    } else {
      return (
        <button
          onClick={(e) => {
            this.setState({ showVocab: !this.state.showVocab });
          }}
          className={"VocabBtn"}
        >
          {"Show Terminology"}
        </button>
      );
    }
  }

  render() {
    return (
      <div className={"About"}>
        <div className={"Info_Title"}>What is Scape?</div>
        <div className={"Text"}>
              A game like Magic; Scape brings all the best aspects of Magic, but
          with a set-deck and more complex actions. Both Players start with the
          same deck (think Chess); its optimized for better game theory/play.
          Instead of the cards telling you what action to take, the player must
          utilize their Will-Power as a resource and cast spells to perform
          rituals that help build towards your victory. Scape is designed for
          high competitive ceiling with a low learning floor. With Five ways to
          achieve victory, it is up to the player to decide their fate. Which
          Ancient will you choose to support?
        </div>




        <div className={"Info_Title"}>Why was Scape Created?</div>
        <div className={"Text"}>
             Scape is different. It's Free to build and play. 
             Scape was created because we felt like Magic was becoming too unstable and bloated;
             Magic, Hearthstone, and most TCG(s) are just too large by way of change due to market driven goals. 
             I wanted to rebuild an engine that was hyper competitive and could support complex, but fair gameplay without the need for a pay wall. 
             As we play-tested this game we realized just how much more efficient, complex, and overall fun Scape started to become. We found ourselves wanting to play Scape more than Magic.
             Another incredible aspect of Scape is that, while the deck doesn't change, the rituals and actions do.
             In other words: we will release new rituals to perform in the game as the development of the game progresses.
             Instead of having a prerelease weekend for new cards; we will have release events for new Rituals.
             we see Ritual based gameplay as the next evolution of competitive card games. 
             The Scape model is more focused on competition gameplay and is built to support a tournament enviroment.
             We hope to release a digital version of the game soon. 


        </div>

        <div style = {{color: "white", fontStyle:"italic", fontWeight: "bold", fontSize:"18px", textAlign:"center"  }}>"I liked the core engine of Magic, but was tired of seeing the massive amount of capitalism canabalise the games integrity."</div>





        <div className={"Info_Title"}>How to Play</div>
        <div>(the rules assume you are familiar with Magic)</div> 
        {this.displayVocab()}
        <div className={"Scroll"}>{this.displayRules()}</div>
        
      </div>
    );
  }
}

export default About;
