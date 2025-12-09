// src/admin/Employees.tsx
import { createSignal, onMount, Show } from "solid-js";
import { supabase } from "../supabaseClient";
import { useOrientation } from "../context/OrientationContext";

interface Employee {
	id: string;
	name: string;
	email: string;
	role: string;
	status: string;
}

interface EmployeesProps {
	companyId: string;
}

export default function Employees(props: EmployeesProps) {
	const { isLandscape } = useOrientation();

	const [employees, setEmployees] = createSignal<Employee[]>([]);
	const [loading, setLoading] = createSignal(true);

	const [showDeleteModal, setShowDeleteModal] = createSignal(false);
	const [employeeToDelete, setEmployeeToDelete] = createSignal<string | null>(null);

	onMount(async () => {
		const { data } = await supabase
			.from("onshift_users")
			.select("id, name, email, role, status")
			.eq("role", "EMPLOYEE");

		setEmployees(sortEmployees((data as Employee[]) || []));
		setLoading(false);
	});

	const sortEmployees = (list: Employee[]) =>
		list
			.slice()
			.sort((a, b) => {
				if (a.status === "CONFIRMED" && b.status === "PENDING") return -1;
				if (a.status === "PENDING" && b.status === "CONFIRMED") return 1;
				return a.name.localeCompare(b.name);
			});

	const confirmEmployee = async (empId: string) => {
		const { error } = await supabase
			.from("onshift_users")
			.update({ status: "CONFIRMED" })
			.eq("id", empId);

		if (error) {
			alert("Errore nella conferma del dipendente: " + error.message);
			return;
		}

		setEmployees(prev =>
			sortEmployees(
				prev.map(emp =>
					emp.id === empId ? { ...emp, status: "CONFIRMED" } : emp
				)
			)
		);
	};

	const suspendEmployee = async (empId: string) => {
		const { error } = await supabase
			.from("onshift_users")
			.update({ status: "PENDING" })
			.eq("id", empId);

		if (error) {
			alert("Errore nella sospensione: " + error.message);
			return;
		}

		setEmployees(prev =>
			sortEmployees(
				prev.map(emp =>
					emp.id === empId ? { ...emp, status: "PENDING" } : emp
				)
			)
		);
	};

	return (
		<>
			<Show when={!loading()} fallback={<div class="text-xl">Caricamento...</div>}>

				{/* TITOLI */}
				<h1 class={`font-bold ${isLandscape() ? "text-2xl" : "text-xl"} mb-4 ml-2`}>
					Dipendenti
				</h1>

				{/* ------------------------------------------- */}
				{/* LANDSCAPE → TABELLA */}
				{/* ------------------------------------------- */}
				<Show when={isLandscape()}>
					<table class="w-full bg-white shadow-md rounded-lg overflow-hidden">
						<thead class="bg-[#0551b5] text-white">
							<tr>
								<th class="text-left p-3">Nome</th>
								<th class="text-left p-3">Email</th>
								<th class="text-left p-3">Stato</th>
								<th class="text-left p-3"></th>
							</tr>
						</thead>

						<tbody>
							{employees().map(emp => (
								<tr class="border-b hover:bg-gray-50 transition">
									<td class="p-3">{emp.name}</td>
									<td class="p-3">{emp.email}</td>
									<td class={`p-3 font-semibold ${emp.status === "PENDING" ? "text-yellow-600" : "text-green-600"}`}>
										{emp.status === "PENDING" ? "SOSPESO" : "ATTIVO"}
									</td>

									<td class="p-3 flex items-center gap-3 justify-end">

										<Show when={emp.status === "PENDING"}>
											<button
												class="h-9 px-5 py-1 bg-[#0551b5] text-white rounded-full text-sm font-semibold shadow transition"
												onClick={() => confirmEmployee(emp.id)}
											>
												Attiva
											</button>
										</Show>

										<Show when={emp.status === "CONFIRMED"}>
											<button
												class="h-9 px-4 py-1 bg-white text-yellow-500 border rounded-full text-sm font-semibold shadow hover:bg-yellow-600 transition"
												onClick={() => suspendEmployee(emp.id)}
											>
												Sospendi
											</button>
										</Show>

										<button
											class="w-9 h-9 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 transition"
											onClick={() => {
												setEmployeeToDelete(emp.id);
												setShowDeleteModal(true);
											}}
										>
											<img src="/trash-white.svg" class="w-4 h-4" />
										</button>

									</td>
								</tr>
							))}
						</tbody>
					</table>
				</Show>

				{/* ------------------------------------------- */}
				{/* PORTRAIT → CARD LIST MODERNA */}
				{/* ------------------------------------------- */}
				<Show when={!isLandscape()}>
					<div class="flex flex-col gap-4">

						{employees().map(emp => (
							<div class="bg-white shadow-md rounded-xl p-4 border border-gray-200 flex flex-col gap-3">

								<div class="flex justify-between items-center">
									<div>
										<div class="text-lg font-semibold text-gray-800">{emp.name}</div>
										<div class="text-sm text-gray-500">{emp.email}</div>
									</div>

									<span
										class={`px-3 py-1 rounded-full font-semibold 
                    ${emp.status === "PENDING"
												? "bg-yellow-100 text-yellow-700"
												: "bg-green-100 text-green-700"}`}
									>
										{emp.status === "PENDING" ? "SOSPESO" : "ATTIVO"}
									</span>
								</div>

								{/* BOTTONI */}
								<div class="flex justify-end gap-2 items-center pt-2">

									<Show when={emp.status === "PENDING"}>
										<button
											class="h-9 px-4 py-1 bg-[#0551b5] text-white rounded-full text-sm font-semibold shadow transition"
											onClick={() => confirmEmployee(emp.id)}
										>
											Attiva
										</button>
									</Show>

									<Show when={emp.status === "CONFIRMED"}>
										<button
											class="h-9 px-4 py-1 bg-white text-yellow-500 border rounded-full text-sm font-semibold shadow transition"
											onClick={() => suspendEmployee(emp.id)}
										>
											Sospendi
										</button>
									</Show>

									<button
										class="w-9 h-9 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 transition"
										onClick={() => {
											setEmployeeToDelete(emp.id);
											setShowDeleteModal(true);
										}}
									>
										<img src="/trash-white.svg" class="w-4 h-4" />
									</button>
								</div>
							</div>
						))}

					</div>
				</Show>

			</Show>


			{/* ------------------------------------------- */}
			{/* MODALE DI ELIMINAZIONE */}
			{/* ------------------------------------------- */}
			<Show when={showDeleteModal()}>
				<div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
					<div class="bg-white p-6 rounded-xl shadow-xl max-w-[90%] text-center border border-gray-200 space-y-4">

						<h2 class="text-xl font-bold text-red-700">Conferma Eliminazione</h2>

						<p>
							Questa operazione è <strong>irreversibile</strong>.<br />
							Il dipendente verrà definitivamente rimosso da onShift.
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
								onClick={async () => {
									if (!employeeToDelete()) return;

									const { error } = await supabase.rpc("admin_delete_employee", {
										emp_id: employeeToDelete()
									});

									if (error) {
										alert("Errore nella cancellazione: " + error.message);
									} else {
										setEmployees(prev =>
											prev.filter(emp => emp.id !== employeeToDelete())
										);
									}

									setShowDeleteModal(false);
									setEmployeeToDelete(null);
								}}
							>
								Elimina
							</button>
						</div>

					</div>
				</div>
			</Show>
		</>
	);
}
