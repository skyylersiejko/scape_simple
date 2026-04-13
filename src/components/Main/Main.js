import React from "react";
import "./Main.css";
import Logo from "../../res/Scape_logo.png";
import About from "../About/About";
import Panel from "../../hoc/Panel/Panel";
import HowTo from '../HowTo/HowTo';
import Cards from '../Cards/Cards';
import BotDemoPromo from "../BotDemoPromo/BotDemoPromo";





class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div className={"Main"}>
        <div className={"Banner"}>
          <div className={"Main_Title"}>
            <img alt={"scape_logo"} src={Logo} />
          </div>
          <div style = {{color: "rgba(214, 195, 73)", textAlign:"center", padding: "15px"}}> version 1.3</div>
        </div>
        <div className={"Site_Content"}>
          <About />
          <BotDemoPromo />
          <Panel/>
          <HowTo/>
          <Cards/>
        </div>
      </div>
    );
  }
}

export default Main;
