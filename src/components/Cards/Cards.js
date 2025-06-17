import React from "react";
import "./Cards.css";
import error_Image from '../../res/scape_back_logo.png';
import CardData from '../../CardData';

class Cards extends React.Component {
  displayCards() {
    if (!CardData) {
      return <h1>No cards added</h1>;
    }
    return (
      <div className="Card_Slider">
        {Object.values(CardData).map((card, idx) => (
          <div className="Card_Container" key={idx}>
            <div className="Card_Info">
              {/* Card type with dynamic color class */}
              <h1 className={`Card_Type ${card.type}`}>{card.type}</h1>
              {/* Card name slightly larger */}
              <h2>{card.name}</h2>
              <h6>@{card.rules_name}</h6>
              <p className="Important_Text">{card.text}</p>

              {card.type === "Being" && (
                <>
                  <h3>{card.power}/{card.defense}</h3>
                  <h3>Nourish</h3>
                  <h3>Cultivate</h3>
                </>
              )}
              {card.type === "Ancient" && (
                <h3>
                  Sacrifice any time to use the ancient ability. Then, remove the ancient from the game.
                </h3>
              )}
              {card.type === "Spell" && (
                <>
                  <h3>Cast a spell anytime</h3>
                  <h3>Study</h3>
                </>
              )}
              {card.type === "Landscape" && <h3>Evolve</h3>}

              <h4>X{card.amount}</h4>
            </div>

            <img
              className="Card_Image"
              src={card.image}
              alt={card.name}
              onError={(e) => { e.target.src = error_Image; }}
            />
          </div>
        ))}
      </div>
    );
  }

  render() {
    return (
      <div className="Card">
        <div className="ScrollBox">
          {this.displayCards()}
        </div>
      </div>
    );
  }
}

export default Cards;