import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { supabase } from "../supabaseClient";

export default function RegisterPage() {
	const navigate = useNavigate();
	const [mode, setMode] = createSignal<"ADMIN" | "EMP">("ADMIN");

	// 🆕 WHITELIST DI EMAIL PER REGISTRARE ADMIN
	// Se l'array è vuoto → tutte le email sono ammesse.
	const allowedAdminEmails: string[] = [
		"bobby@example.com",
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
			setAdminError("❌ Questa email non è autorizzata alla registrazione admin.");
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
			setEmpMessage("❌ Errore creazione utente: " + signUpError.message);
			return;
		}

		const user = data.user;
		if (!user) {
			setEmpMessage("❌ Errore interno: user non creato.");
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
			setEmpMessage("❌ Invite code non valido.");
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
			setEmpMessage("❌ Errore creazione profilo: " + profileErr.message);
			return;
		}

		setEmpMessage("✅ Registrazione completata! Torna al login.");
	}

	// -------------------------------------------------------------
	// UI
	// -------------------------------------------------------------

	return (
		<div class="min-h-screen flex items-center justify-center bg-gray-100">
			<div class="bg-white shadow-lg rounded-xl p-8 w-[420px]">

				<h1 class="text-2xl font-semibold text-center mb-6">
					Crea un nuovo account
				</h1>

				{/* Toggle */}
				<div class="flex justify-center mb-6">
					<button
						class={`px-4 py-2 rounded-l ${mode() === "ADMIN"
								? "bg-blue-600 text-white"
								: "bg-gray-200 text-gray-600"
							}`}
						onClick={() => setMode("ADMIN")}
					>
						Admin
					</button>

					<button
						class={`px-4 py-2 rounded-r ${mode() === "EMP"
								? "bg-blue-600 text-white"
								: "bg-gray-200 text-gray-600"
							}`}
						onClick={() => setMode("EMP")}
					>
						Dipendente
					</button>
				</div>

				{/* FORM ADMIN ------------------------------------------------ */}
				<Show when={mode() === "ADMIN"}>
					<div class="flex flex-col gap-2">

						<input
							class="border p-2 rounded"
							placeholder="Nome Azienda"
							value={companyName()}
							onInput={(e) => setCompanyName(e.currentTarget.value)}
						/>

						{/* 🆕 CAMPO NOME */}
						<input
							class="border p-2 rounded"
							placeholder="Nome completo"
							onInput={(e) => setAdminName(e.currentTarget.value)}
						/>

						<input
							class="border p-2 rounded"
							type="email"
							placeholder="Email"
							onInput={(e) => setAdminEmail(e.currentTarget.value)}
						/>

						<input
							class="border p-2 rounded"
							type="password"
							placeholder="Password"
							onInput={(e) => setAdminPassword(e.currentTarget.value)}
						/>

						<button
							class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded mt-2"
							onClick={handleRegisterAdmin}
						>
							Crea Account Admin
						</button>

						{adminError() && <p class="text-red-500">{adminError()}</p>}
					</div>
				</Show>

				{/* FORM EMPLOYEE ------------------------------------------- */}
				<Show when={mode() === "EMP"}>
					<div class="flex flex-col gap-2">

						<input
							class="border p-2 rounded"
							placeholder="Nome"
							onInput={(e) => setEmpName(e.currentTarget.value)}
						/>

						<input
							class="border p-2 rounded"
							type="email"
							placeholder="Email"
							onInput={(e) => setEmpEmail(e.currentTarget.value)}
						/>

						<input
							class="border p-2 rounded"
							type="password"
							placeholder="Password"
							onInput={(e) => setEmpPassword(e.currentTarget.value)}
						/>

						<input
							class="border p-2 rounded"
							placeholder="Invite Code"
							onInput={(e) => setInviteCode(e.currentTarget.value)}
						/>

						<button
							class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded mt-2"
							onClick={handleRegisterEmployee}
						>
							Crea Account Dipendente
						</button>

						<p>{empMessage()}</p>
					</div>
				</Show>

				<p
					class="text-center text-sm text-gray-600 mt-4 cursor-pointer"
					onClick={() => navigate("/")}
				>
					Torna al login
				</p>

			</div>
		</div>
	);
}
