import { useOrientation } from "../context/OrientationContext";
import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { supabase } from "../supabaseClient";

export default function Register() {
	const { isLandscape } = useOrientation();
	const navigate = useNavigate();
	const [mode, setMode] = createSignal<"ADMIN" | "EMP">("ADMIN");

	const [showSuccessModal, setShowSuccessModal] = createSignal(false);

	// 🆕 WHITELIST DI EMAIL PER REGISTRARE ADMIN
	// Se l'array è vuoto → tutte le email sono ammesse.
	const allowedAdminEmails: string[] = [
		//"bobby@example.com",
		// "azienda@dominio.it"
	];

	// Campi admin
	const [companyName, setCompanyName] = createSignal("");
	const [adminName, setAdminName] = createSignal("");  // 🆕 NUOVO CAMPO
	const [adminEmail, setAdminEmail] = createSignal("");
	const [adminPassword, setAdminPassword] = createSignal("");
	const [adminError, setAdminError] = createSignal("");

	// Campi employee
	const [empName, setEmpName] = createSignal("");
	const [empEmail, setEmpEmail] = createSignal("");
	const [empPassword, setEmpPassword] = createSignal("");
	const [inviteCode, setInviteCode] = createSignal("");
	const [empMessage, setEmpMessage] = createSignal("");

	// -------------------------------------------------------------
	// 🔵 REGISTRAZIONE ADMIN — (LOGICA IDENTICA + 2 MODIFICHE)
	// -------------------------------------------------------------
	async function handleRegisterAdmin() {
		setAdminError("");

		// ---------------------------------------
		// VALIDAZIONI LATO CLIENT
		// ---------------------------------------
		if (!companyName().trim()) {
			setAdminError("Inserisci il nome dell'attività.");
			return;
		}
		if (!adminName().trim()) {
			setAdminError("Inserisci il tuo nome.");
			return;
		}
		if (!adminEmail().trim()) {
			setAdminError("Inserisci un'email.");
			return;
		}
		if (!adminPassword().trim() || adminPassword().length < 6) {
			setAdminError("La password deve contenere almeno 6 caratteri.");
			return;
		}

		// ---------------------------------------
		// 0) CONTROLLA WHITELIST (PRIMA DI SIGNUP)
		// ---------------------------------------
		if (
			allowedAdminEmails.length > 0 &&
			!allowedAdminEmails.includes(adminEmail().toLowerCase())
		) {
			setAdminError("Questa email non è autorizzata alla registrazione admin.");
			return;
		}

		// ---------------------------------------
		// 1) CREA L'UTENTE IN AUTH
		// ---------------------------------------
		const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
			email: adminEmail(),
			password: adminPassword(),
		});

		let user = signUpData?.user;

		if (signUpError) {
			// Caso tipico: utente già esistente → proviamo login
			if ((signUpError as any).code === "user_already_exists") {
				const { data: loginData, error: loginErr } =
					await supabase.auth.signInWithPassword({
						email: adminEmail(),
						password: adminPassword(),
					});

				if (loginErr || !loginData.user) {
					setAdminError(
						"Questa email risulta già registrata. Se hai un account, accedi dal login."
					);
					return;
				}

				user = loginData.user;
			} else {
				setAdminError("Errore registrazione: " + signUpError.message);
				return;
			}
		}

		if (!user) {
			setAdminError("Errore interno: impossibile creare l'utente.");
			return;
		}

		// 🚀 Ora l'utente è autenticato e possiamo procedere.

		// ---------------------------------------
		// 2) CREA / RECUPERA L'AZIENDA
		// ---------------------------------------
		const { data: existingCompany } = await supabase
			.from("onshift_companies")
			.select("id")
			.eq("admin_id", user.id)
			.maybeSingle();

		let companyId;

		if (!existingCompany) {
			const invite = crypto.randomUUID().slice(0, 6);

			const { data: companyData, error: companyErr } = await supabase
				.from("onshift_companies")
				.insert({
					name: companyName(),
					admin_id: user.id,
					invite_code: invite,
				})
				.select("id")
				.single();

			if (companyErr) {
				setAdminError("Errore nella creazione dell'azienda: " + companyErr.message);
				return;
			}

			companyId = companyData.id;
		} else {
			companyId = existingCompany.id;
		}

		// ---------------------------------------
		// 3) CREA PROFILO ADMIN SE NON ESISTE GIÀ
		// ---------------------------------------
		const { data: existingProfile } = await supabase
			.from("onshift_users")
			.select("id")
			.eq("id", user.id)
			.maybeSingle();

		if (!existingProfile) {
			const { error: profileErr } = await supabase
				.from("onshift_users")
				.insert({
					id: user.id,
					company_id: companyId,
					role: "ADMIN",
					name: adminName(),
					email: adminEmail(),
					status: "CONFIRMED"
				});

			if (profileErr) {
				setAdminError(
					"Errore nella creazione del profilo admin: " + profileErr.message
				);
				return;
			}
		}

		// ---------------------------------------
		// 4) METADATA JWT (idempotenti)
		// ---------------------------------------
		await supabase.auth.updateUser({
			data: {
				companies: [{ company_id: companyId }],
				role: "ADMIN"
			}
		});

		setShowSuccessModal(true);
	}


	// -------------------------------------------------------------
	// 🟢 REGISTRAZIONE DIPENDENTE — invariata
	// -------------------------------------------------------------
	async function handleRegisterEmployee() {
		setEmpMessage("");

		// -----------------------------
		// VALIDAZIONI LATO CLIENT
		// -----------------------------
		if (!empName().trim()) {
			setEmpMessage("Inserisci il tuo nome.");
			return;
		}
		if (!empEmail().trim()) {
			setEmpMessage("Inserisci una email.");
			return;
		}
		if (!empPassword().trim() || empPassword().length < 6) {
			setEmpMessage("La password deve contenere almeno 6 caratteri.");
			return;
		}
		if (!inviteCode().trim()) {
			setEmpMessage("Inserisci il codice di invito.");
			return;
		}

		// -----------------------------
		// 1) CONTROLLA CODICE INVITO PRIMA DI TUTTO
		// -----------------------------
		const { data: company, error: inviteErr } = await supabase
			.from("onshift_companies")
			.select("id")
			.eq("invite_code", inviteCode())
			.maybeSingle();

		if (inviteErr || !company) {
			setEmpMessage("Codice di invito non valido.");
			return;
		}

		const companyId = company.id;

		// -----------------------------
		// 2) CREA L'UTENTE IN AUTH
		// -----------------------------
		const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
			email: empEmail(),
			password: empPassword(),
		});

		let user = signUpData?.user;

		if (signUpError) {
			// Caso comune: utente già registrato
			if ((signUpError as any).code === "user_already_exists") {
				// Proviamo login
				const { data: loginData, error: loginError } =
					await supabase.auth.signInWithPassword({
						email: empEmail(),
						password: empPassword(),
					});

				if (loginError || !loginData.user) {
					setEmpMessage("Email già registrata. Vai al login.");
					return;
				}

				user = loginData.user;
			} else {
				setEmpMessage("Errore registrazione: " + signUpError.message);
				return;
			}
		}

		if (!user) {
			setEmpMessage("Errore interno: impossibile creare l'utente.");
			return;
		}

		// -----------------------------
		// 3) CREA PROFILO SOLO SE NON ESISTE GIÀ
		// -----------------------------
		const { data: existingProfile } = await supabase
			.from("onshift_users")
			.select("id")
			.eq("id", user.id)
			.maybeSingle();

		if (!existingProfile) {
			const { error: profileErr } = await supabase
				.from("onshift_users")
				.insert({
					id: user.id,
					company_id: companyId,
					role: "EMPLOYEE",
					name: empName(),
					email: empEmail(),
					status: "PENDING"
				});

			if (profileErr) {
				setEmpMessage("Errore creazione profilo: " + profileErr.message);
				return;
			}
		}

		// -----------------------------
		// 4) METADATA JWT
		// -----------------------------
		await supabase.auth.updateUser({
			data: {
				companies: [{ company_id: companyId }],
				role: "EMPLOYEE"
			}
		});

		setShowSuccessModal(true);
	}


	// -------------------------------------------------------------
	// UI
	// -------------------------------------------------------------

	return (
		<>
			<div class={`min-h-screen flex items-center justify-center ${isLandscape() ? "bg-gray-50" : ""}`}>
				<div class={`bg-white ${isLandscape() ? "shadow-lg" : ""} rounded-xl p-8 w-96`}>

					<h1 class="text-2xl font-semibold text-center mb-10">
						Crea un nuovo account
					</h1>

					{/* Toggle */}
					<div class="flex justify-center mb-6 gap-3 text-sm">
						<button
							class={`flex items-center justify-center w-28 h-8 rounded-full ${mode() === "ADMIN"
								? "bg-black text-white"
								: "bg-white text-gray-600 border"
								}`}
							onClick={() => setMode("ADMIN")}
						>
							Titolare
						</button>

						<button
							class={`flex items-center justify-center w-28 h-8 rounded-full ${mode() === "EMP"
								? "bg-black text-white"
								: "bg-white text-gray-600 border"
								}`}
							onClick={() => setMode("EMP")}
						>
							Dipendente
						</button>
					</div>

					{/* FORM ADMIN ------------------------------------------------ */}
					<Show when={mode() === "ADMIN"}>

						<div class="text-sm text-gray-500 flex items-center justify-center text-center mb-6">
							Registra la tua attività come titolare, ottieni il pieno controllo e dai l'accesso ai tuoi dipendenti
						</div>

						<div class="flex flex-col gap-2 justify-between">

							<input
								class="border border-gray-300 p-2 rounded"
								placeholder="Nome Attività"
								value={companyName()}
								onInput={(e) => setCompanyName(e.currentTarget.value)}
							/>

							{/* 🆕 CAMPO NOME */}
							<input
								class="border border-gray-300 p-2 rounded"
								placeholder="Nome Utente"
								onInput={(e) => setAdminName(e.currentTarget.value)}
							/>

							<input
								class="border border-gray-300 p-2 rounded"
								type="email"
								placeholder="Email"
								onInput={(e) => setAdminEmail(e.currentTarget.value)}
							/>

							<input
								class="border border-gray-300 p-2 rounded"
								type="password"
								placeholder="Password"
								onInput={(e) => setAdminPassword(e.currentTarget.value)}
							/>

							<button
								class="bg-[#0551b5] text-white p-2 rounded-full font-semibold mt-2"
								onClick={handleRegisterAdmin}
							>
								Crea Account Titolare
							</button>

							{adminError() && <p class="text-sm text-center mt-3 px-6 py-1 bg-red-100 text-red-600 rounded-full">{adminError()}</p>}
						</div>
					</Show>

					{/* FORM EMPLOYEE ------------------------------------------- */}
					<Show when={mode() === "EMP"}>

						<div class="text-sm text-gray-500 flex items-center justify-center text-center mb-6">
							Registrati come dipendente, dovrai inserire il codice d'invito fornito dal tuo titolare
						</div>

						<div class="flex flex-col gap-2 justify-between">

							<input
								class="border border-gray-300 p-2 rounded"
								placeholder="Nome"
								onInput={(e) => setEmpName(e.currentTarget.value)}
							/>

							<input
								class="border border-gray-300 p-2 rounded"
								type="email"
								placeholder="Email"
								onInput={(e) => setEmpEmail(e.currentTarget.value)}
							/>

							<input
								class="border border-gray-300 p-2 rounded"
								type="password"
								placeholder="Password"
								onInput={(e) => setEmpPassword(e.currentTarget.value)}
							/>

							<input
								class="border border-gray-300 p-2 rounded"
								placeholder="Codice d'invito"
								onInput={(e) => setInviteCode(e.currentTarget.value)}
							/>

							<button
								class="bg-[#0551b5] text-white p-2 rounded-full font-semibold mt-2"
								onClick={handleRegisterEmployee}
							>
								Crea Account Dipendente
							</button>

							{empMessage() && <p class="text-sm text-center mt-3 px-6 py-1 bg-red-100 text-red-600 rounded-full">{empMessage()}</p>}
						</div>
					</Show>

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
						<p class="text-sm text-gray-700">Registrazione completata con successo! Ti reindirizzeremo alla pagina di login.</p>

						<button
							class="bg-[#0551b5] text-white px-4 py-2 rounded-full font-semibold w-full"
							onClick={() => {
								setShowSuccessModal(false);
								navigate("/"); // Torna al login
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
