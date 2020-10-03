import React from "react";
import "./Cards.css";
import error_Image from '../../res/scape_back_logo.png'
import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript";

class Cards extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      show: false,
    };
  }

  displayCards() {
   
      if (this.props.cards) {
        return (
          <div className={"Card_Slider"}>
            {Object.values(this.props.cards).map((card) => {
              return (
                <React.Fragment >
                  <div className = {"Card_Container"}>
                    
                  {(card.type === "Being")?
                  <div className = {"Card_Data"}>
                    <h1>{card.type}</h1>
                    
                   
                    <img
                      src={card.image}
                      onError={(e) => {
                        e.target.src = error_Image;
                      }}
                    />
                    <div className = {"SubBox"}>
                    <h2>{card.name} </h2>
                    <h6>@ {card.rules_name}</h6>
                    <h4 className = {"Important_Text"}>{card.text}</h4>
                    
              

                    {(card.type == "Being")? <h3>{card.power+"/"+card.defense}</h3>:null}
                    {(card.type == "Being")? <h3>Nourish</h3>:null}
                    {(card.type == "Being")? <h3>Cultivate</h3>:null}
                    {(card.name == "Wasp")? <h3>Flying</h3>:null}
                    {(card.name == "Wasp")? <h3 className = {"Alt_Text"}> Alternate casting: Exhausting 3 landscapes, Exhausting 2 landscapes and discarding a card as an additional cost, Exhausting 2 landscapes and sacrificing a landscape as an additional cost</h3>:null}

                    <h4>X{card.amount}</h4>
                   
                    </div>
                  </div>:
                      (card.type === "Ancient")?
                      <div className = {"Card_Ancient"}>
                        <h1>{card.type}</h1>
                       
                      <img
                        src={card.image}
                        onError={(e) => {
                          e.target.src = error_Image;
                        }}
                      />
                      <div className = {"SubBox"}>
                      <h2>{card.name} </h2>
                      <h6>@{card.rules_name}</h6>
                      <h3 className = {"Important_Text"}>{card.text}</h3>
                      <h3> sacrifice any time to use the ancient ability</h3>
                      <h4>X{card.amount}</h4>
                   

                      </div>
                      </div>:
                        (card.type === "Spell")?
                      <div className = {"Card_Spell"}>
                       <h1>{card.type}</h1>
                      <img
                      src={card.image}
                      onError={(e) => {
                        e.target.src = error_Image;
                      }}
                      />
                      <div className = {"SubBox"}>
                      <h2>{card.name} </h2>
                      <h6>@{card.rules_name}</h6>
                      <h3 className = {"Important_Text"}>{card.text}</h3>
                      <h3> Cast a spell anytime</h3>
                      <h4>X{card.amount}</h4>

                    {(card.type == "Spell")? <h3>Study</h3>:null}
                    {(card.name == "Cancel")? <h3>Exile cancel from your hand and pay its cost: reselect an ancient.</h3>:null}
                   
                      </div>
                      </div>:
                        <div className = {"Card_Landscape"}>
                        <h1>{card.type}</h1>
                        
                       <img
                       src={card.image}
                       onError={(e) => {
                         e.target.src = error_Image;
                       }}
                       />
                       <div className = {"SubBox"}>
                       <h2>{card.name} </h2>
                       <h6>@{card.rules_name}</h6>
                       <h3 className = {"Important_Text"}>{card.text}</h3>
                       <h3> Cast a spell anytime</h3>
                      {(card.type == "Landscape")? <h3>Evolve</h3>:null}
                      <h4>X{card.amount}</h4>

                      </div>
                      </div>
                    
                    


                      


            }
            
            </div>
                </React.Fragment>
              );
            })}
          </div>
        );
      } else {
        return <h1>no cards added</h1>;
      }
   
  }

  render() {
    return (
      <div className={"Card"}>
         <div className = {"Title"}>Cards</div>
         <div className = {"Panel"}>
         <div className = {"LeftPanel"}>
          
        <h1>Tournaments starting in January!</h1>
        </div>
        <div className = {"ScrollBox"}>
          {this.displayCards()}
        </div>
        <div className = {"RightPanel"}>
        <h1>Tournaments starting in January</h1>
        </div>
      
       
        </div>
      </div>
    );
  }
}

export default Cards;
