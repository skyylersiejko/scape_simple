import React from "react";
import "./BotDemoPromo.css";

const DEFAULT_DEMO_URL = "/bot-demo/";
const APP_VERSION = "1.1.6";
const GITHUB_RELEASE_BASE = `https://github.com/skyylersiejko/scape_simple/releases/download/v${APP_VERSION}`;
const MAC_URL = `${GITHUB_RELEASE_BASE}/Scape-${APP_VERSION}-mac.dmg`;
const WIN_URL = `${GITHUB_RELEASE_BASE}/Scape-Setup-${APP_VERSION}-win.exe`;

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
        Play
      </a>
      <div className={"BotDemoPromo_Downloads"}>
        <a className={"BotDemoPromo_Install"} href={MAC_URL} download>
          ⬇ Install for Mac <span className={"BotDemoPromo_Version"}>v{APP_VERSION}</span>
        </a>
        <a className={"BotDemoPromo_Install"} href={WIN_URL} download>
          ⬇ Install for Windows <span className={"BotDemoPromo_Version"}>v{APP_VERSION}</span>
        </a>
      </div>
    </section>
  );
}

export default BotDemoPromo;