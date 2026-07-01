import { Route } from "@solidjs/router";

import Login from "./auth/Login";
import Register from "./auth/Register";
import Dashboard from "./dashboard/Dashboard";

export default function App() {
	return (
		<>
			<Route path="/" component={Login} />
			<Route path="/register" component={Register} />
			<Route path="/app" component={Dashboard} />
		</>
	);
}
