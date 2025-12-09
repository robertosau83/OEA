/* @refresh reload */
import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./App";
import { OrientationProvider } from "./context/OrientationContext";
import "./index.css";

render(
  () => (
    <OrientationProvider>
      <Router>
        <App />
      </Router>
    </OrientationProvider>
  ),
  document.getElementById("root")!
);