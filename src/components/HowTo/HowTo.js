import rules from "./Rules";
import React from "react";
import "./HowTo.css"

class About extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        showVocab: false,
        showDeck:false,
        showCards:false,
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

    displayDeck(){
      return (<div>
        <h2>Deck proxy (Mtg-to-Scape)</h2>
        <div className = {"Deck_Container"}>
          <ul>
            {rules.DECK_TO_MTG.map((card, index) =>{
              return <li  key = {index}>{card}</li>
            })}
          </ul>

          <button
              onClick={(e) => {
                this.setState({ showCards: !this.state.showCards });
              }}
              className={"VocabBtn"}
            >{(this.state.showCards)? <div>hide card Images</div>:<div>show card images</div>}</button>

            {(this.state.showCards)? rules.PROXY_IMAGES.map((image, index) =>{
            return <div className = {"Small_Card"}><img src = {image} /></div>
            }):null}
       </div>

       <h3> Deck Cost: $3.28</h3>

</div>
)
    }
  
    displayVocab() {
      if (this.state.showVocab) {
        return (
          <div className={"Terminology"}>
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
            <div className = {"Mobile"}>
            <button
              onClick={(e) => {
                this.setState({ showVocab: !this.state.showVocab });
              }}
              className={"VocabBtn"}
            >
            
              {"Hide Terminology"}
            </button>
            </div>
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
        <div className={"HowTo"}>
    
  
  
  
         {/**  <div className={"Info_Title"}>Update(s)</div>**/}
          <div className={"MiddleText"}>
               We are currently play testing and starting development on the digital version of the game in Unity. email us if you would like to purchase a paper copy of Scape.
            
            
            
               <button
              onClick={(e) => {
                this.setState({ showDeck: !this.state.showDeck });
              }}
              className={"VocabBtn"}
            >deck proxy</button>
            
            
            
              {(this.state.showDeck)?this.displayDeck():null}
               <div style = {{color: "white", fontStyle:"bold", fontWeight: "bold", fontSize:"18px", textAlign:"center", padding:"10px"  }}>scapedcg@gmail.com</div>
  
          </div>
  
          
  
  
          <div className={"Info_Title"}>
              
              How to Play
              
              <div style = {{color: "white", fontStyle:"bold", fontWeight: "bold", fontSize:"12px", textAlign:"center", padding:"10px"  }}>(the rules assume you are familiar with other TCG(s))</div>
  
              
              </div>
          <div className = {"Term"} >
            {this.displayVocab()}
            <div className={"Scroll"}>{this.displayRules()}</div>
          </div>
          
        </div>
      );
    }
  }
  
  export default About;