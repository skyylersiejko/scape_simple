import React from "react";
import "./Panel.css";
import YouTube from 'react-youtube';
import Player from 'react-player';
import Cards from "../../components/Cards/Cards";
import Media from "../../components/Media/Media";
import scape_download from "../../res/Scape_Kit.zip"
import Picture from '../../res/waterfall_logo.png'



class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
        <div className = {"Panel"}>
        
     
      
       </div>
    );
  }
}

export default Main;


/*

<a className = {"Download"} href={scape_download} download>Download the Play Kit</a>
<img className = {"Picture"} src = {Picture}/>
 <Media type = {"youtube"}/>

*/