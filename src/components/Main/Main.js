import React from "react";
import "./Main.css";
import Logo from "../../res/Scape_logo.png";
import About from "../About/About";
import Panel from "../../hoc/Panel/Panel";




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
        </div>
        <About />
   
        
       <Panel/>
      </div>
    );
  }
}

export default Main;
