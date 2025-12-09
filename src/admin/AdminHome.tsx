import { createSignal, Show } from "solid-js";
import { supabase } from "../supabaseClient";
import { useNavigate } from "@solidjs/router";

interface AdminHomeProps {
	loading: boolean;
	userName: string;
	setUserName: (v: string) => void;
	userEmail: string;
	role: string;
	companyName: string;
	setCompanyName: (v: string) => void;
	companyId: string;
	inviteCode: string;
}

export default function AdminHome(props: AdminHomeProps) {

	const navigate = useNavigate();

	// reactive invite code
	const [inviteCode, setInviteCode] = createSignal(props.inviteCode);
	const [copied, setCopied] = createSignal(false);
	const [showToast, setShowToast] = createSignal(false);

	// modals
	const [showModal, setShowModal] = createSignal(false);
	const [modalField, setModalField] = createSignal<"user" | "company" | null>(null);
	const [newValue, setNewValue] = createSignal("");

	const [showDeleteModal, setShowDeleteModal] = createSignal(false);

	const brandBlue = "#0551b5";

	const handleSave = async () => {
		if (modalField() === "user") {
			const { error } = await supabase
				.from("onshift_users")
				.update({ name: newValue() })
				.eq("email", props.userEmail);

			if (!error) {
				props.setUserName(newValue());
			}
		}

		if (modalField() === "company") {
			const { error } = await supabase
				.from("onshift_companies")
				.update({ name: newValue() })
				.eq("id", props.companyId);

			if (!error) {
				props.setCompanyName(newValue());
			}
		}

		setShowModal(false);
	};

	const regenerateInviteCode = async () => {
		const newCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
			.map(b => b.toString(16).padStart(2, "0"))
			.join("")
			.slice(0, 8);

		const { error } = await supabase
			.from("onshift_companies")
			.update({ invite_code: newCode })
			.eq("id", props.companyId);

		if (!error) {
			setInviteCode(newCode);
		}
	};

	const copyInviteCode = async () => {
		const text = inviteCode();

		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
				setShowToast(true);
				setTimeout(() => setShowToast(false), 2000);
				return;
			}
		} catch (_) { }

		try {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.left = "-9999px";

			document.body.appendChild(textarea);
			textarea.select();
			textarea.setSelectionRange(0, 99999);

			const success = document.execCommand("copy");
			document.body.removeChild(textarea);

			if (success) {
				setShowToast(true);
				setTimeout(() => setShowToast(false), 2000);
				return;
			}

			throw new Error("fallback failed");
		} catch (err) {
			alert("Impossibile copiare il codice");
		}
	};

	const handleDeleteAccount = async () => {
		const { error } = await supabase.rpc("admin_delete_account");

		if (error) {
			alert("Errore nella cancellazione dell'account: " + error.message);
			return;
		}

		await supabase.auth.signOut();
		navigate("/");
	};

	return (
		<>
			<Show when={!props.loading} fallback={<div class="text-xl text-gray-600">Caricamento...</div>}>

				<div class="space-y-8 max-w-2xl">

					{/* TITLE */}
					<h1 class="font-bold text-2xl ml-2 tracking-tight text-gray-800">
						Account
					</h1>

					{/* USER CARD */}
					<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
						<h2 class="text-xl font-semibold text-gray-800 mb-4">Profilo Utente</h2>

						<div class="space-y-3 text-gray-700">

							<div class="flex justify-between items-center">
								<div>
									<span class="font-medium text-gray-900">Nome</span>
									<p>{props.userName}</p>
								</div>

								<button
									class="px-5 py-1.5 bg-[#0551b5] text-white rounded-full shadow-sm text-sm font-semibold transition-colors"
									onClick={() => {
										setModalField("user");
										setNewValue(props.userName);
										setShowModal(true);
									}}
								>
									Modifica
								</button>
							</div>

							<div>
								<span class="font-medium text-gray-900">Email</span>
								<p>{props.userEmail}</p>
							</div>

							<div>
								<span class="font-medium text-gray-900">Ruolo</span>
								<p class="capitalize">{props.role.toLowerCase()}</p>
							</div>

						</div>
					</div>

					{/* COMPANY CARD */}
					<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
						<h2 class="text-xl font-semibold text-gray-800 mb-4">Azienda</h2>

						<div class="space-y-3 text-gray-700">

							<div class="flex justify-between items-center">
								<div>
									<span class="font-medium text-gray-900">Nome azienda</span>
									<p>{props.companyName}</p>
								</div>

								<button
									class="px-5 py-1.5 bg-[#0551b5] text-white rounded-full shadow-sm text-sm font-semibold transition-colors"
									onClick={() => {
										setModalField("company");
										setNewValue(props.companyName);
										setShowModal(true);
									}}
								>
									Modifica
								</button>
							</div>

							<div class="flex justify-between items-center gap-3">
								<div>
									<span class="font-medium text-gray-900">Invite Code</span>

									<div class="flex items-center gap-3 mt-1">
										<p class="font-mono tracking-wide text-lg">{inviteCode()}</p>

										{/* COPY BUTTON */}
										<button
											class="w-8 h-8 flex items-center justify-center bg-white border border-[#0551b5] rounded-md transition"
											onClick={copyInviteCode}
											title="Copia"
										>
											<img src="/copy.svg" class="w-5 h-5" />
										</button>

										{/* FEEDBACK "COPIATO!" */}
										<Show when={copied()}>
											<span class="text-green-600 text-sm font-semibold">Copiato!</span>
										</Show>
									</div>
								</div>

								{/* RIGENERA */}
								<button
									class="px-5 py-1.5 bg-yellow-500 text-white rounded-full shadow-sm text-sm font-semibold hover:bg-yellow-600 transition-colors whitespace-nowrap"
									onClick={regenerateInviteCode}
								>
									Rigenera
								</button>
							</div>


						</div>
					</div>

					{/* DELETE ACCOUNT */}
					<div class="pt-8">
						<button
							class="px-4 py-2 bg-white text-red-600 border-2 border-red-600 rounded-full shadow-sm hover:bg-red-100 transition-colors"
							onClick={() => setShowDeleteModal(true)}
						>
							Elimina Account
						</button>
					</div>
				</div>

			</Show>

			{/* ---------------------- */}
			{/* MODAL MODIFICA DATI */}
			{/* ---------------------- */}
			<Show when={showModal()}>
				<div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
					<div class="bg-white p-6 rounded-xl shadow-xl w-80 space-y-4 border border-gray-200">
						<h2 class="text-xl font-semibold text-gray-800">
							Modifica {modalField() === "user" ? "nome utente" : "nome azienda"}
						</h2>

						<input
							class="border border-gray-300 w-full px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
							value={newValue()}
							onInput={(e) => setNewValue(e.currentTarget.value)}
						/>

						<div class="flex justify-end space-x-2">
							<button
								class="px-3 py-1 text-gray-700 hover:text-gray-900"
								onClick={() => setShowModal(false)}
							>
								Annulla
							</button>
							<button
								class="px-4 py-1.5 bg-[#0551b5] text-white rounded-md shadow-sm transition-colors"
								onClick={handleSave}
							>
								Salva
							</button>
						</div>
					</div>
				</div>
			</Show>

			{/* ---------------------- */}
			{/* MODAL DELETE ACCOUNT */}
			{/* ---------------------- */}
			<Show when={showDeleteModal()}>
				<div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
					<div class="bg-white p-6 rounded-xl shadow-xl max-w-[90%] text-center border border-gray-200 space-y-4">

						<h2 class="text-2xl font-bold text-red-700">Eliminazione Account</h2>
						<p class="text-gray-700">
							Questa operazione è <strong>irreversibile</strong>. Verranno eliminati
							la tua azienda, i dipendenti e il tuo account.
						</p>

						<div class="flex justify-center space-x-3 pt-2">
							<button
								class="px-4 py-1.5 border rounded-md text-gray-700 hover:bg-gray-100 transition"
								onClick={() => setShowDeleteModal(false)}
							>
								Annulla
							</button>

							<button
								class="px-4 py-1.5 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 transition-colors"
								onClick={handleDeleteAccount}
							>
								Elimina
							</button>
						</div>

					</div>
				</div>
			</Show>

			{/* ---------------------- */}
			{/* TOAST COPY SUCCESS */}
			{/* ---------------------- */}
			<Show when={showToast()}>
				<div
					class="
      fixed left-1/2 -translate-x-1/2 bottom-6
      bg-[#0551b5] text-white text-sm font-semibold
      px-4 py-2 rounded-full shadow-lg
      animate-slideFade
      z-50
    "
				>
					Copiato!
				</div>
			</Show>

		</>
	);
}
