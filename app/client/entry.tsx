import { render } from "hono/jsx/dom";
import { App } from "./app";

const root = document.getElementById("root")
if (!root) {
	console.error("Root element is missing")
} else {
	render(<App />, root);
}
