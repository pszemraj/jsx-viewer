import React from "react";
import ReactDOM from "react-dom/client";
import "./index-browser.css";
import AppBrowser from "./AppBrowser";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element '#root' was not found.");
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <AppBrowser />
  </React.StrictMode>,
);
