// src/admin/Employees.tsx
import { createSignal, onMount, Show } from "solid-js";
import { supabase } from "../supabaseClient";

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
	const [employees, setEmployees] = createSignal<Employee[]>([]);
	const [loading, setLoading] = createSignal(true);

	onMount(async () => {
		const { data } = await supabase
			.from("onshift_users")
			.select("id, name, email, role, status")
			.eq("role", "EMPLOYEE");

		setEmployees((data as Employee[]) || []);

		console.log(employees());

		setLoading(false);
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

		// Aggiorna localmente l'array dei dipendenti
		setEmployees(prev =>
			prev.map(emp =>
				emp.id === empId ? { ...emp, status: "CONFIRMED" } : emp
			)
		);
	};

	return (
		<Show when={!loading()} fallback={<div class="text-xl">Caricamento...</div>}>

			<div>
				<h1 class="font-bold text-3xl mb-4">Dipendenti</h1>

				<table class="w-full bg-white shadow-md rounded-lg overflow-hidden">
					<thead class="bg-[#0551b5] text-white">
						<tr>
							<th class="text-left p-3">Nome</th>
							<th class="text-left p-3">Email</th>
							{/* <th class="text-left p-3">Ruolo</th> */}
							<th class="text-left p-3">Stato</th>
							<th class="text-left p-3"></th>
						</tr>
					</thead>

					<tbody>
						{employees().map(emp => (
							<tr class="border-b hover:bg-gray-100">
								<td class="p-3">{emp.name}</td>
								<td class="p-3">{emp.email}</td>
								<td class="p-3">{emp.status}</td>
								{/* <td class="p-3">{emp.role}</td> */}
								<td class="p-3 flex items-center gap-3 justify-end">
									<Show when={emp.status === "PENDING"}>
										<button
											class="px-6 py-1 bg-white text-black rounded-full font-semibold border-2 border-black"
											onClick={() => confirmEmployee(emp.id)}
										>
											Conferma
										</button>
									</Show>
									<Show when={emp.status === "CONFIRMED"}>
										<button
											class="px-6 py-1 bg-red-100 text-black rounded-full font-semibold border-2 border-black"
											//onClick={() => confirmEmployee(emp.id)}
										>
											Cancella
										</button>
									</Show>
								</td>

							</tr>
						))}
					</tbody>
				</table>
			</div>

		</Show>
	);
}
