// src/admin/AdminHome.tsx
import { createSignal, Show } from "solid-js";
import { supabase } from "../supabaseClient";
import { useNavigate } from "@solidjs/router";

interface AdminHomeProps {
	loading: boolean;
	userName: string;
	userEmail: string;
	role: string;
	companyName: string;
	companyId: string;
	inviteCode: string;
}

export default function AdminHome(props: AdminHomeProps) {

	const navigate = useNavigate();
	
	const [userName, setUserName] = createSignal(props.userName);
	const [companyName, setCompanyName] = createSignal(props.companyName);
	const [inviteCode, setInviteCode] = createSignal(props.inviteCode);

	const [showModal, setShowModal] = createSignal(false);
	const [modalField, setModalField] = createSignal<"user" | "company" | null>(null);
	const [newValue, setNewValue] = createSignal("");

	const [showDeleteModal, setShowDeleteModal] = createSignal(false);

	const handleSave = async () => {
		if (modalField() === "user") {
			const { error } = await supabase
				.from("onshift_users")
				.update({ name: newValue() })
				.eq("email", props.userEmail);

			if (!error) {
				setUserName(newValue());
			}
		}

		if (modalField() === "company") {
			const { error } = await supabase
				.from("onshift_companies")
				.update({ name: newValue() })
				.eq("id", props.companyId);

			if (!error) {
				setCompanyName(newValue());
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
			setInviteCode(newCode); // <-- aggiornamento reattivo
		}
	};


	const handleDeleteAccount = async () => {
		const { error } = await supabase.rpc("admin_delete_account");

		if (error) {
			alert("Errore nella cancellazione dell'account: " + error.message);
			return;
		}

		// logout dopo cancellazione
		await supabase.auth.signOut();

		// redirect
		navigate("/")
	};


	return (
		<>
			<Show when={!props.loading} fallback={<div class="text-xl">Caricamento...</div>}>

				<div class="space-y-4">
					<h1 class="font-bold text-3xl mb-4">Dati Utente</h1>

					<p>
						<strong>Nome:</strong> {userName()}
						<button
							class="ml-3 px-2 py-1 bg-blue-600 text-white rounded text-sm"
							onClick={() => {
								setModalField("user");
								setNewValue(props.userName);
								setShowModal(true);
							}}
						>
							Modifica
						</button>
					</p>
					<p><strong>Email:</strong> {props.userEmail}</p>
					<p><strong>Ruolo:</strong> {props.role}</p>
					<p>
						<strong>Azienda:</strong> {companyName()}
						<button
							class="ml-3 px-2 py-1 bg-blue-600 text-white rounded text-sm"
							onClick={() => {
								setModalField("company");
								setNewValue(props.companyName);
								setShowModal(true);
							}}
						>
							Modifica
						</button>
					</p>
					<p>
						<strong>Invite Code:</strong> {inviteCode()}
						<button
							class="ml-3 px-2 py-1 bg-yellow-600 text-white rounded text-sm"
							onClick={regenerateInviteCode}
						>
							Rigenera
						</button>
					</p>

					<button
						class="mt-6 px-4 py-2 bg-red-600 text-white rounded"
						onClick={() => setShowDeleteModal(true)}
					>
						Cancella Account
					</button>

				</div>

			</Show>

			<Show when={showModal()}>
				<div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
					<div class="bg-white p-4 rounded shadow-md w-80 space-y-3">
						<h2 class="text-lg font-bold">Modifica {modalField() === "user" ? "nome utente" : "nome azienda"}</h2>

						<input
							class="border w-full px-2 py-1 rounded"
							value={newValue()}
							onInput={(e) => setNewValue(e.currentTarget.value)}
						/>

						<div class="flex justify-end space-x-2">
							<button class="px-3 py-1" onClick={() => setShowModal(false)}>Annulla</button>
							<button class="px-3 py-1 bg-green-600 text-white rounded" onClick={handleSave}>
								Salva
							</button>
						</div>
					</div>
				</div>
			</Show>

			<Show when={showDeleteModal()}>
				<div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
					<div class="bg-white p-5 rounded shadow-lg max-w-sm text-center space-y-4">

						<h2 class="text-xl font-bold text-red-700">Conferma Eliminazione</h2>

						<p>
							Questa operazione è <strong>irreversibile</strong>.<br />
							Verranno eliminati la tua azienda, tutti i dipendenti
							e il tuo account utente.
						</p>

						<div class="flex justify-center space-x-3">
							<button
								class="px-3 py-1 rounded border"
								onClick={() => setShowDeleteModal(false)}
							>
								Annulla
							</button>

							<button
								class="px-3 py-1 bg-red-600 text-white rounded"
								onClick={handleDeleteAccount}
							>
								Eliminazione definitiva
							</button>
						</div>

					</div>
				</div>
			</Show>

		</>


	);
}
