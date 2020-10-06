import React from "react";
import ReactDOM from "react-dom";
import firebase from "firebase";

import App from "./App";

const rootElement = document.getElementById("root");


const config = {
  apiKey: "AIzaSyDelGmzr0L8TwJabvejGy0MyvQKdx2rvPU",
  authDomain: "scapesimple.firebaseapp.com",
  databaseURL: "https://scapesimple.firebaseio.com",
  projectId: "scapesimple",
  storageBucket: "scapesimple.appspot.com",
  messagingSenderId: "574011483224",
  appId: "1:574011483224:web:28875aa2edfd4506bc962d",
  measurementId: "G-EC56BZ6NRZ"
};

firebase.initializeApp(config);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  rootElement
);
