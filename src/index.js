import React from "react";
import ReactDOM from "react-dom";
import firebase from "firebase";

import App from "./App";

const rootElement = document.getElementById("root");


const firebaseConfig = {
  apiKey: "AIzaSyBfQeHwVthluCeywDTktpdzF4_FVYTejVs",
  authDomain: "scape-fc6ca.firebaseapp.com",
  projectId: "scape-fc6ca",
  storageBucket: "scape-fc6ca.appspot.com",
  messagingSenderId: "163782063815",
  appId: "1:163782063815:web:7d4d226f7f65ea2cc630e2",
  measurementId: "G-P658D8D3XQ"
};


firebase.initializeApp(config);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  rootElement
);
