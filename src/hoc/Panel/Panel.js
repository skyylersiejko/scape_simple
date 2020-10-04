import React from "react";
import "./Panel.css";
import YouTube from 'react-youtube';
import Player from 'react-player';
import Cards from "../../components/Cards/Cards";
import Media from "../../components/Media/Media";
import scape_download from "../../res/Scape_Kit.zip"



class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
        <div className = {"Panel"}>
            <div className = {"LeftPanel"}>
            <a className = {"Download"} href={scape_download} download>Download the Play Kit</a>
            <Media type = {"intro"}/>
        </div>
        <div className = {"ScrollBox"}>
           <Cards/>
        </div>
        <div className = {"RightPanel"}>
        <h1>Tournaments starting in January!</h1>
        <Media type = {"youtube"}/>
        </div>
     
      
       </div>
    );
  }
}

export default Main;