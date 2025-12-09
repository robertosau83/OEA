// src/admin/AdminHome.tsx
import { createSignal, Show } from "solid-js";
import { supabase } from "../supabaseClient";
import { useNavigate } from "@solidjs/router";

interface EmployeeHomeProps {
	loading: boolean;
	userName: string;
	userEmail: string;
	role: string;
	companyName: string;
	companyId: string;
	inviteCode: string;
}

export default function EmployeeHome(props: EmployeeHomeProps) {

	const navigate = useNavigate();

	const [showDeleteModal, setShowDeleteModal] = createSignal(false);

	const handleDeleteAccount = async () => {
		const { error } = await supabase.rpc("employee_delete_self");

		if (error) {
			alert("Errore nella cancellazione dell'account: " + error.message);
			return;
		}

		await supabase.auth.signOut();
		navigate("/");
	};

	return (
		<>
			<Show when={!props.loading} fallback={<div class="text-xl">Caricamento...</div>}>

				<div class="space-y-4">
					<h1 class="font-bold text-3xl mb-4">Dati Utente</h1>

					<p><strong>Nome:</strong> {props.userName}</p>
					<p><strong>Email:</strong> {props.userEmail}</p>
					<p><strong>Ruolo:</strong> {props.role}</p>
					<p><strong>Azienda:</strong> {props.companyName}</p>

					<button
						class="mt-6 px-4 py-2 bg-red-600 text-white rounded"
						onClick={() => setShowDeleteModal(true)}
					>
						Cancella Account
					</button>

				</div>

			</Show>

			<Show when={showDeleteModal()}>
				<div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
					<div class="bg-white p-5 rounded shadow-lg max-w-sm text-center space-y-4">

						<h2 class="text-xl font-bold text-red-700">Conferma Eliminazione</h2>

						<p>
							Questa operazione è <strong>irreversibile</strong>.<br />
							Il tuo account verrà eliminato da onShift e non sarai più visibile al tuo titolare.
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
