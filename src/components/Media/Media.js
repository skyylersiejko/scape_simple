import React from "react";
import "./Media.css";
import YouTube from 'react-youtube';
import Player from 'react-player';
import Intro from '../../res/Scape_Title_Screen.mov';

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
    
      <YouTube className = {"Introduction"} videoId="93cztlMM-TU" opts={this.state.opts} onReady={this._onReady} />:
      (this.props.type === "intro")?

        <Player  
        url={Intro}
        className='react-player'
        playing = {true}
        width="100%"
        loop = {true}
        height="100%"
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
