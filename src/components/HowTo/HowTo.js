// src/components/HowTo/HowTo.js
import React from "react";
import rules from "./Rules";
import "./HowTo.css";
import Media from "../Media/Media";

class HowTo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showVocab: false,
      showDeck: false,
      showCards: false,
    };
  }

  displayRules() {
    const headers = Object.keys(rules);
    return headers.map((title, i) => (
      <section key={i}>
        <h2 className="Sub_Title">{title}</h2>
        <ul className="Rules_List">
          {rules[title].map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      </section>
    ));
  }

  displayDeck() {
    return (
      <section className="Deck_Section">
        <h2>Deck Proxy (MTG-to-Scape)</h2>
        <div className="Deck_Container">
          <ul>
            {rules.DECK_TO_MTG.map((card, i) => (
              <li key={i}>{card}</li>
            ))}
          </ul>
          <button
            className="VocabBtn"
            onClick={() =>
              this.setState((s) => ({ showCards: !s.showCards }))
            }
          >
            {this.state.showCards ? "Hide Card Images" : "Show Card Images"}
          </button>
          {this.state.showCards && (
            <div className="Card_Images">
              {rules.PROXY_IMAGES.map((src, k) => (
                <img className="Small_Card" key={k} src={src} alt={`card-${k}`} />
              ))}
            </div>
          )}
        </div>
        <p className="Deck_Cost">Deck Cost: $3.28</p>
      </section>
    );
  }

  displayVocab() {
    const terms = [
      ["Exhaust", "Tap"],
      ["Harvested", "Sac or use"],
      ["Ritual", "sequence of actions that must occur to create an event"],
      ["Being", "creature"],
      ["Ancient", "Commander"],
      ["Will-Power (WP)", "life"],
      ["Landscape", "basic land"],
      ["Replenish", "untap and upkeep"],
      ["Yard", "discard pile"],
      ["Recycle", "shuffle your hand into your deck and draw that many cards."],
      ["/", "add to the stack or play card with forward order"],
    ];

    return this.state.showVocab ? (
      <div className="Terminology">
        <ul>
          {terms.map(([term, def], i) => (
            <li key={i}><strong>{term}:</strong> {def}</li>
          ))}
        </ul>
        <button className="VocabBtn" onClick={() => this.setState({ showVocab: false })}>
          Hide Terminology
        </button>
      </div>
    ) : (
      <button className="VocabBtn" onClick={() => this.setState({ showVocab: true })}>
        Show Terminology
      </button>
    );
  }

  render() {
    return (
      <div className="HowTo">
        <div className="MiddleText">
          We are play testing and developing the digital version of the game.
          Email us at scapedcg@gmail.com for a paper copy of Scape.
          <button
            className="VocabBtn"
            onClick={() => this.setState((s) => ({ showDeck: !s.showDeck }))}
          >
            Deck Proxy
          </button>
          {this.state.showDeck && this.displayDeck()}
        </div>

        <div className="Info_Title">
          How to Play
          <p className="Subtitle">(assumes familiarity with other TCGs)</p>
        </div>

        <Media type="youtube" />

        <div className="Term">
          {this.displayVocab()}
          <div className="Scroll">{this.displayRules()}</div>
        </div>
      </div>
    );
  }
}

export default HowTo;