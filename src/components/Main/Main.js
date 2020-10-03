import React from "react";
import "./Main.css";
import Logo from "../../res/Scape_logo.png";
import About from "../About/About";
import Cards from "../Cards/Cards";
import CardData from '../../CardData';


class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div className={"Main"}>
        <div className={"Banner"}>
          <div className={"Title"}>
            <img alt={"scape_logo"} src={Logo} />
          </div>
        </div>
        <About />
        <Cards cards = {CardData}  />
      </div>
    );
  }
}

export default Main;
