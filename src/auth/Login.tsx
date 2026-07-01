import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useOrientation } from "../context/OrientationContext";
import { supabase } from "../supabaseClient";

export default function Login() {
	const navigate = useNavigate();
	const { isLandscape } = useOrientation();

	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [message, setMessage] = createSignal("");

	async function handleLogin() {
		setMessage("");

		const { data: loginData, error } = await supabase.auth.signInWithPassword({
			email: email(),
			password: password(),
		});

		if (error) {
			setMessage("Email o password errati.");
			return;
		}

		const user = loginData.user;
		if (!user) {
			setMessage("Errore: utente non trovato dopo il login.");
			return;
		}

		const { data: profile, error: profileErr } = await supabase
			.from("oea_users")
			.select("id, status")
			.eq("id", user.id)
			.maybeSingle();

		if (profileErr || !profile) {
			await supabase.auth.signOut();
			setMessage("Account non autorizzato.");
			return;
		}

		if (profile.status !== "ACTIVE") {
			await supabase.auth.signOut();
			setMessage("Account in attesa di autorizzazione.");
			return;
		}

		navigate("/app");
	}

	return (
		<div class={`min-h-screen flex items-center justify-center ${isLandscape() ? "bg-gray-50" : ""}`}>
			<div class={`bg-white ${isLandscape() ? "shadow-lg" : ""} rounded-xl p-8 w-96`}>
				<h1 class="text-3xl font-bold text-center mb-16">OEA</h1>

				<input
					type="email"
					placeholder="Email"
					class="w-full p-2 border border-gray-300 rounded mb-3"
					onInput={(e) => setEmail(e.currentTarget.value)}
					onKeyDown={(e) => e.key === "Enter" && handleLogin()}
				/>

				<input
					type="password"
					placeholder="Password"
					class="w-full p-2 border border-gray-300 rounded mb-4"
					onInput={(e) => setPassword(e.currentTarget.value)}
					onKeyDown={(e) => e.key === "Enter" && handleLogin()}
				/>

				<button
					class="w-full h-11 bg-[#0551b5] text-white p-2 rounded-full mb-3 font-semibold"
					onClick={handleLogin}
				>
					Login
				</button>

				<p class="text-center text-sm text-gray-500 my-4">oppure</p>

				<button
					class="w-full h-11 bg-white text-black rounded-full mb-3 font-semibold border-2 border-black"
					onClick={() => navigate("/register")}
				>
					Registrati
				</button>

				{message() && <p class="text-sm text-center mt-3 px-6 py-1 bg-red-100 text-red-600 rounded-full">{message()}</p>}
			</div>
		</div>
	);
}
