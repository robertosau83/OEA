import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { supabase } from "../supabaseClient";

interface RegisterProps {
  isLandscape: boolean;
}

export default function Register(props: RegisterProps) {
	const navigate = useNavigate();
	const [mode, setMode] = createSignal<"ADMIN" | "EMP">("ADMIN");

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

		// 0️⃣ CONTROLLA SE L'EMAIL È AUTORIZZATA
		// - Se allowedAdminEmails è vuoto → tutti possono registrarsi
		// - Altrimenti → solo email nella lista
		if (
			allowedAdminEmails.length > 0 &&
			!allowedAdminEmails.includes(adminEmail().toLowerCase())
		) {
			setAdminError("Questa email non è autorizzata alla registrazione admin.");
			return;
		}

		// 1️⃣ CREA UTENTE AUTH
		const { error: signUpError } = await supabase.auth.signUp({
			email: adminEmail(),
			password: adminPassword(),
		});

		if (signUpError) {
			setAdminError("Errore registrazione: " + signUpError.message);
			return;
		}

		// 2️⃣ LOGIN AUTOMATICO
		const { error: loginError } = await supabase.auth.signInWithPassword({
			email: adminEmail(),
			password: adminPassword(),
		});

		if (loginError) {
			setAdminError("Errore login: " + loginError.message);
			return;
		}

		// 3️⃣ OTTIENI USER ID
		const { data: userData } = await supabase.auth.getUser();
		const userId = userData?.user?.id;
		if (!userId) {
			setAdminError("Impossibile ottenere l'ID utente.");
			return;
		}

		// 4️⃣ CREA COMPANY solo se non esiste
		const { data: existingCompany } = await supabase
			.from("onshift_companies")
			.select("id")
			.eq("admin_id", userId)
			.maybeSingle();

		let companyId;

		if (!existingCompany) {
			const invite = crypto.randomUUID().slice(0, 6);

			const { data: companyData, error: companyError } = await supabase
				.from("onshift_companies")
				.insert({
					name: companyName(),
					admin_id: userId,
					invite_code: invite,
				})
				.select("id")
				.single();

			if (companyError) {
				setAdminError(
					"Errore nella creazione dell'azienda: " + companyError.message
				);
				return;
			}

			companyId = companyData.id;
		} else {
			companyId = existingCompany.id;
		}

		// 5️⃣ CREA PROFILO UTENTE (🆕 Aggiunto il campo name)
		const { error: userInsertError } = await supabase
			.from("onshift_users")
			.insert({
				id: userId,
				company_id: companyId,
				role: "ADMIN",
				name: adminName(),  // 🆕 SALVATAGGIO DEL NOME
			});

		if (userInsertError) {
			setAdminError("Errore creazione profilo utente: " + userInsertError.message);
			return;
		}

		navigate("/");
	}

	// -------------------------------------------------------------
	// 🟢 REGISTRAZIONE DIPENDENTE — invariata
	// -------------------------------------------------------------
	async function handleRegisterEmployee() {
		setEmpMessage("");

		// 1) CREA UTENTE AUTH
		const { data, error: signUpError } = await supabase.auth.signUp({
			email: empEmail(),
			password: empPassword(),
		});

		if (signUpError) {
			setEmpMessage("Errore creazione utente: " + signUpError.message);
			return;
		}

		const user = data.user;
		if (!user) {
			setEmpMessage("Errore interno: user non creato.");
			return;
		}

		// 2) LOGIN AUTOMATICO
		const { error: loginErr } = await supabase.auth.signInWithPassword({
			email: empEmail(),
			password: empPassword(),
		});

		if (loginErr) {
			setEmpMessage("Errore login dopo registrazione: " + loginErr.message);
			return;
		}

		// 3) CERCA COMPANY
		const { data: companies, error: inviteErr } = await supabase
			.from("onshift_companies")
			.select("id")
			.eq("invite_code", inviteCode());

		if (inviteErr || !companies || companies.length === 0) {
			setEmpMessage("Invite code non valido.");
			return;
		}

		const companyId = companies[0].id;

		// 4) CREA PROFILO
		const { error: profileErr } = await supabase
			.from("onshift_users")
			.insert({
				id: user.id,
				company_id: companyId,
				role: "EMPLOYEE",
				name: empName(),
			});

		if (profileErr) {
			setEmpMessage("Errore creazione profilo: " + profileErr.message);
			return;
		}

		setEmpMessage("✅ Registrazione completata! Torna al login.");
	}

	// -------------------------------------------------------------
	// UI
	// -------------------------------------------------------------

	return (
		<div class={`min-h-screen flex items-center justify-center ${props.isLandscape ? "bg-gray-50" : ""}`}>
			<div class={`bg-white ${props.isLandscape ? "shadow-lg" : ""} rounded-xl p-8 w-96`}>

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
						Registrati come dipendente, dovrai fornire il codice d'invito in mano al tuo titolare
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
	);
}
