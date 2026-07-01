import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useOrientation } from "../context/OrientationContext";
import { supabase } from "../supabaseClient";

export default function Register() {
	const navigate = useNavigate();
	const { isLandscape } = useOrientation();

	const [name, setName] = createSignal("");
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [message, setMessage] = createSignal("");
	const [showSuccessModal, setShowSuccessModal] = createSignal(false);

	async function handleRegister() {
		setMessage("");

		if (!name().trim()) {
			setMessage("Inserisci il tuo nome.");
			return;
		}

		if (!email().trim()) {
			setMessage("Inserisci un'email.");
			return;
		}

		if (!password().trim() || password().length < 6) {
			setMessage("La password deve contenere almeno 6 caratteri.");
			return;
		}

		const normalizedEmail = email().trim().toLowerCase();

		const { error } = await supabase.auth.signUp({
			email: normalizedEmail,
			password: password(),
			options: {
				data: {
					name: name().trim(),
				},
			},
		});

		if (error) {
			setMessage("Errore registrazione: " + error.message);
			return;
		}

		setShowSuccessModal(true);
	}

	return (
		<>
			<div class={`min-h-screen flex items-center justify-center ${isLandscape() ? "bg-gray-50" : ""}`}>
				<div class={`bg-white ${isLandscape() ? "shadow-lg" : ""} rounded-xl p-8 w-96`}>
					<h1 class="text-2xl font-semibold text-center mb-10">
						Crea un nuovo account
					</h1>

					<div class="flex flex-col gap-2 justify-between">
						<input
							class="border border-gray-300 p-2 rounded"
							placeholder="Nome"
							onInput={(e) => setName(e.currentTarget.value)}
						/>

						<input
							class="border border-gray-300 p-2 rounded"
							type="email"
							placeholder="Email"
							onInput={(e) => setEmail(e.currentTarget.value)}
						/>

						<input
							class="border border-gray-300 p-2 rounded"
							type="password"
							placeholder="Password"
							onInput={(e) => setPassword(e.currentTarget.value)}
							onKeyDown={(e) => e.key === "Enter" && handleRegister()}
						/>

						<button
							class="bg-[#0551b5] text-white p-2 rounded-full font-semibold mt-2"
							onClick={handleRegister}
						>
							Crea Account
						</button>

						{message() && <p class="text-sm text-center mt-3 px-6 py-1 bg-red-100 text-red-600 rounded-full">{message()}</p>}
					</div>

					<p
						class="text-center text-sm text-gray-500 mt-7 cursor-pointer"
						onClick={() => navigate("/")}
					>
						Torna al login
					</p>
				</div>
			</div>

			<Show when={showSuccessModal()}>
				<div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
					<div class="bg-white p-6 rounded-xl shadow-xl w-80 text-center space-y-4">
						<h2 class="text-lg font-bold">Registrazione completata</h2>
						<p class="text-sm text-gray-700">Registrazione completata. L'accesso sara' disponibile dopo l'autorizzazione dell'utente.</p>

						<button
							class="bg-[#0551b5] text-white px-4 py-2 rounded-full font-semibold w-full"
							onClick={() => {
								setShowSuccessModal(false);
								navigate("/");
							}}
						>
							Ok
						</button>
					</div>
				</div>
			</Show>
		</>
	);
}
