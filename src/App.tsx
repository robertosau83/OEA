import { createSignal, onMount } from "solid-js";
import { Route } from "@solidjs/router";
import Login from "./auth/Login"
import Register from "./auth/Register";
import AdminHome from "./admin/AdminHome";
import EmployeeHome from "./employee/EmployeeHome";
import AdminIndex from "./admin/index";

export default function App() {

	const [isLandscape, setIsLandscape] = createSignal(window.innerWidth > window.innerHeight);
	const updateOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);

	// Listener per aggiornare quando cambia l’orientamento
	onMount(() => {
		window.addEventListener('resize', updateOrientation);
		return () => window.removeEventListener('resize', updateOrientation);
	});

	return (
		<>
			<Route path="/" component={() => <Login isLandscape={isLandscape()} />} />
			<Route path="/register" component={() => <Register isLandscape={isLandscape()} />} />

			{/* Home protette */}
			<Route path="/admin" component={AdminIndex} />
			<Route path="/employee" component={EmployeeHome} />
		</>
	);
}
