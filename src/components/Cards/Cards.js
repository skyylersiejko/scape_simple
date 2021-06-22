import React from "react";
import "./Cards.css";
import error_Image from '../../res/scape_back_logo.png'
import Media from '../Media/Media';
import CardData from '../../CardData';

class Cards extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      show: false,
    };
  }

  displayCards() {
   
      if (CardData) {
        return (
          <div className={"Card_Slider"}>
            <div className = {"Card_Title"}>Cards</div>
            {Object.values(CardData).map((card, index) => {
              return (
                <React.Fragment key = {index} >
                  <div  className = {"Card_Container"}>
                    
                  {(card.type === "Being")?
                  <div className = {"Card_Being"}>
                    <div className = {"Mobile"}>
                      <h1>{card.type}</h1>
                
                      <img className = {"Card_Image"}
                        src={card.image}
                        onError={(e) => {
                          e.target.src = error_Image;
                        }}
                      />
                        <div className = {"SubBox"}>
                          <h4>{card.name} </h4>
                          <h6>@ {card.rules_name}</h6>
                          <h6 className = {"Important_Text"}>{card.text}</h6>
                          
                    

                          {(card.type == "Being")? <h3>{card.power+"/"+card.defense}</h3>:null}
                          {(card.type == "Being")? <h3>Nourish</h3>:null}
                          {(card.type == "Being")? <h3>Cultivate</h3>:null}
                          {(card.name == "Wasp")? <h6>Flying</h6>:null}
                          {(card.name == "wasp")? <h6 className = {"Alt_Text"}> Alternate casting: Exhausting 3 landscapes, Exhausting 2 landscapes and discarding a card as an additional cost, Exhausting 2 landscapes and sacrificing a landscape as an additional cost</h6>:null}

                      <h4>X{card.amount}</h4>
                    
                      </div>
                    </div>
                  </div>:
                      (card.type === "Ancient")?
                      
                      <div className = {"Card_Ancient"}>
                        <div className = {"Mobile"}>
                          <h1>{card.type}</h1>
                        
                          <img className = {"Card_Image"}
                            src={card.image}
                            onError={(e) => {
                              e.target.src = error_Image;
                            }}
                          />
                          <div className = {"SubBox"}>
                            <h2>{card.name} </h2>
                            <h6>@{card.rules_name}</h6>
                            <h3 className = {"Important_Text"}>{card.text}</h3>
                            <h3> sacrifice any time to use the ancient ability. Then, remove the ancient from the game.</h3>
                            
                            <h4>X{card.amount}</h4>
                      

                          </div>
                        </div>
                      </div>:
                        (card.type === "Spell")?
                      <div className = {"Card_Spell"}>
                        <div className = {"Mobile"}>
                          <h1>{card.type}</h1>
                          <img className = {"Card_Image"}
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
                              

                              {(card.type == "Spell")? <h3>Study</h3>:null}
                              {(card.name == "Cancel")? <h6>Exile cancel from your hand and pay its' cost: reselect an ancient.</h6>:null}
                              <h4>X{card.amount}</h4>
                        
                            </div>
                        </div>
                      </div>:
                        <div className = {"Card_Landscape"}>
                          <div className = {"Mobile"}>
                          <h1>{card.type}</h1>
                          
                          <img className = {"Card_Image"}
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
        
        <div className = {"ScrollBox"}>
          {this.displayCards()}
        </div>
        
      
       
        </div>
   
    );
  }
}

export default Cards;
