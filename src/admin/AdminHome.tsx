// src/admin/AdminHome.tsx
import { createSignal, Show, createEffect } from "solid-js";
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

	const [inviteCode, setInviteCode] = createSignal(props.inviteCode);
	const [showToast, setShowToast] = createSignal(false);

	// Modals
	const [showModal, setShowModal] = createSignal(false);
	const [modalField, setModalField] = createSignal<"user" | "company" | null>(null);
	const [newValue, setNewValue] = createSignal("");

	const [showDeleteModal, setShowDeleteModal] = createSignal(false);

	// 🔥 Sincronizza Invite Code quando cambia nei props
	createEffect(() => {
		setInviteCode(props.inviteCode);
	});

	// -----------------------------
	// SALVA MODIFICA USER / COMPANY
	// -----------------------------
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

	// -----------------------------
	// RIGENERA INVITE CODE
	// -----------------------------
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

	// -----------------------------
	// COPY INVITE CODE
	// -----------------------------
	const copyInviteCode = async () => {
		const text = inviteCode();

		try {
			await navigator.clipboard.writeText(text);
			setShowToast(true);
			setTimeout(() => setShowToast(false), 2000);
		} catch (e) {
			alert("Impossibile copiare il codice");
		}
	};

	// -----------------------------
	// DELETE ACCOUNT
	// -----------------------------
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

					<h1 class="font-bold text-2xl ml-2 tracking-tight text-gray-800">
						Account
					</h1>

					{/* USER CARD */}
					<div class="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
						<h2 class="text-xl font-semibold mb-4">Profilo Utente</h2>

						<div class="space-y-3">
							<div class="flex justify-between items-center">
								<div>
									<span class="font-medium text-gray-900">Nome</span>
									<p>{props.userName}</p>
								</div>

								<button
									class="px-5 py-1.5 bg-[#0551b5] text-white rounded-full text-sm"
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
								<span class="font-medium">Email</span>
								<p>{props.userEmail}</p>
							</div>

							<div>
								<span class="font-medium">Ruolo</span>
								<p class="capitalize">{props.role.toLowerCase()}</p>
							</div>
						</div>
					</div>

					{/* COMPANY CARD */}
					<div class="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
						<h2 class="text-xl font-semibold mb-4">Azienda</h2>

						<div class="space-y-3">

							<div class="flex justify-between items-center">
								<div>
									<span class="font-medium text-gray-900">Nome azienda</span>
									<p>{props.companyName}</p>
								</div>

								<button
									class="px-5 py-1.5 bg-[#0551b5] text-white rounded-full text-sm"
									onClick={() => {
										setModalField("company");
										setNewValue(props.companyName);
										setShowModal(true);
									}}
								>
									Modifica
								</button>
							</div>

							{/* INVITE CODE */}
							<div class="flex justify-between items-center">
								<div>
									<span class="font-medium text-gray-900">Invite Code</span>
									<div class="flex items-center gap-3 mt-1">
										<p class="font-mono tracking-wide text-lg">{inviteCode()}</p>

										<button
											class="w-8 h-8 flex items-center justify-center bg-white border rounded-md"
											onClick={copyInviteCode}
										>
											<img src="/copy.svg" class="w-5 h-5" />
										</button>
									</div>
								</div>

								<button
									class="px-5 py-1.5 bg-yellow-500 text-white rounded-full text-sm"
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
							class="px-4 py-2 bg-white text-red-600 border-2 border-red-600 rounded-full"
							onClick={() => setShowDeleteModal(true)}
						>
							Elimina Account
						</button>
					</div>
				</div>

			</Show>

			{/* MODAL - Modifica */}
			<Show when={showModal()}>
				<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div class="bg-white p-6 rounded-xl shadow-xl w-80 space-y-4">
						<h2 class="text-xl font-semibold">
							Modifica {modalField() === "user" ? "nome utente" : "nome azienda"}
						</h2>

						<input
							class="border w-full px-3 py-2 rounded-md"
							value={newValue()}
							onInput={(e) => setNewValue(e.currentTarget.value)}
						/>

						<div class="flex justify-end gap-2">
							<button onClick={() => setShowModal(false)}>Annulla</button>
							<button class="px-4 py-1.5 bg-[#0551b5] text-white rounded-md" onClick={handleSave}>
								Salva
							</button>
						</div>
					</div>
				</div>
			</Show>

			{/* MODAL DELETE */}
			<Show when={showDeleteModal()}>
				<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div class="bg-white p-6 rounded-xl max-w-[90%] text-center space-y-4">
						<h2 class="text-2xl font-bold text-red-700">Eliminazione Account</h2>
						<p>Tutta l'azienda e i dipendenti verranno eliminati.</p>

						<div class="flex justify-center gap-3">
							<button onClick={() => setShowDeleteModal(false)}>Annulla</button>
							<button class="px-4 py-1.5 bg-red-600 text-white rounded-md" onClick={handleDeleteAccount}>
								Elimina
							</button>
						</div>
					</div>
				</div>
			</Show>

			{/* TOAST COPY */}
			<Show when={showToast()}>
				<div class="fixed left-1/2 -translate-x-1/2 bottom-6 bg-[#0551b5] text-white px-4 py-2 rounded-full shadow-lg">
					Copiato!
				</div>
			</Show>
		</>
	);
}
