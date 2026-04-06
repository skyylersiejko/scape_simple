import React from "react";
import "./BotDemoPromo.css";

const DEFAULT_DEMO_URL = "/bot-demo/";

function BotDemoPromo() {
  const demoUrl = process.env.REACT_APP_BOT_DEMO_URL || DEFAULT_DEMO_URL;

  return (
    <section className={"BotDemoPromo"}>
      <a
        className={"BotDemoPromo_Button"}
        href={demoUrl}
        target={"_blank"}
        rel={"noopener noreferrer"}
      >
        Play Demo
      </a>
    </section>
  );
}

export default BotDemoPromo;