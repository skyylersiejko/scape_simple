import React from "react";
import "./Media.css";
import YouTube from 'react-youtube';
import Player from 'react-player';
import Intro from '../../res/Ancients.png';

class Media extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      opts: {
        height: '500px',
        width: '500px',
        playerVars: {
          // https://developers.google.com/youtube/player_parameters
          autoplay:0,
        }
     
    },
  }
}



_onReady(e){
  e.target.pauseVideo();
}

  render() {
    return <div className={"Media"}>
     { (this.props.type === "youtube")?
    
      <YouTube className = {"Introduction"} videoId="C6AwN0yOx3Y" opts={this.state.opts} onReady={this._onReady} />:
      (this.props.type === "intro")?

        <img 
        src={Intro}
        className={"Left_Image"}
        />:
        <Player  
        url={this.props.url || Intro}
        className='react-player'
        playing = {true}
        width='100%'
        loop = {true}
        height='100%'
        />

        
         
          
       
    
    }
      </div>;
  }
}

export default Media;
