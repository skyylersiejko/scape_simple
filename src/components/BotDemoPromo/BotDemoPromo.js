import React from "react";
import "./BotDemoPromo.css";
import ChromeLogo from "../../res/platform_chrome.png";
import AppleLogo from "../../res/platform_apple.png";
import WindowsLogo from "../../res/platform_windows.png";

const DEFAULT_DEMO_URL = "/bot-demo/";

/**
 * Version of the *published desktop installers*.
 *
 * This tracks the newest GitHub Release that actually has assets attached, which is
 * not necessarily the site version — the website can ship ahead of an installer
 * build. Pointing these links at a version whose DMG/EXE has not been built and
 * uploaded would 404 for anyone who clicked them.
 *
 * When new installers are released, bump this one constant.
 */
const INSTALLER_VERSION = "1.2.1";
const RELEASE_BASE = `https://github.com/skyylersiejko/scape_simple/releases/download/v${INSTALLER_VERSION}`;
const MAC_URL = `${RELEASE_BASE}/Scape-${INSTALLER_VERSION}-mac.dmg`;
const WIN_URL = `${RELEASE_BASE}/Scape-Setup-${INSTALLER_VERSION}-win.exe`;

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
        <img className={"BotDemoPromo_Icon"} src={ChromeLogo} alt={""} aria-hidden={"true"} />
        <span>Play</span>
      </a>

      <div className={"BotDemoPromo_Downloads"}>
        <a
          className={"BotDemoPromo_Install"}
          href={MAC_URL}
          target={"_blank"}
          rel={"noopener noreferrer"}
        >
          <img className={"BotDemoPromo_Icon"} src={AppleLogo} alt={""} aria-hidden={"true"} />
          <span>Install for Mac</span>
          <span className={"BotDemoPromo_Version"}>v{INSTALLER_VERSION}</span>
        </a>
        <a
          className={"BotDemoPromo_Install"}
          href={WIN_URL}
          target={"_blank"}
          rel={"noopener noreferrer"}
        >
          <img className={"BotDemoPromo_Icon"} src={WindowsLogo} alt={""} aria-hidden={"true"} />
          <span>Install for Windows</span>
          <span className={"BotDemoPromo_Version"}>v{INSTALLER_VERSION}</span>
        </a>
      </div>
    </section>
  );
}

export default BotDemoPromo;
