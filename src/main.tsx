import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { globalStyles } from "./styles/stitches.config";

import "@fontsource/changa";

globalStyles();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
