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
          {rule.map((child) => {
            return <li>{child}</li>;
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

    return result.map((child) => {
      return <p>{child}</p>;
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
              Ritual = sequence of events that must occur to create an event
            </li>
            <li> Being = "creature"</li>
            <li> Ancient = "Commander"</li>
            <li> WillPower (WP) = "life"</li>
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
            {"Hide Termonology"}
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
          {"Show Termonology"}
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
          utilize their WillPower as a resource and cast spells to perform
          rituals that help build towards your victory. Scape is designed for
          high competative ceiling with a low learning floor. With Five ways to
          achieve victory, it is up to the player to decide their fate. Which
          Ancient will you choose to support?
        </div>
        <div className={"Info_Title"}>How to Play</div>
        {this.displayVocab()}
        <div className={"Scroll"}>{this.displayRules()}</div>
        
      </div>
    );
  }
}

export default About;
