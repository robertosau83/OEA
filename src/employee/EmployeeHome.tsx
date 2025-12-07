import { createSignal, onMount, Show } from "solid-js";
import { supabase } from "../supabaseClient";
import { useNavigate } from "@solidjs/router";

export default function EmployeeHome() {
	const navigate = useNavigate();

	const [userName, setUserName] = createSignal("");
	const [userEmail, setUserEmail] = createSignal("");
	const [role, setRole] = createSignal("");
	const [companyName, setCompanyName] = createSignal("");
	const [inviteCode, setInviteCode] = createSignal("");
	const [loading, setLoading] = createSignal(true);

	onMount(async () => {
		const { data: session } = await supabase.auth.getSession();
		const user = session?.session?.user;

		if (!user) {
			navigate("/");
			return;
		}

		setUserEmail(user.email ?? "");

		const { data: profile } = await supabase
			.from("onshift_users")
			.select("name, role, company_id")
			.eq("id", user.id)
			.single();

		if (profile) {
			setUserName(profile.name);
			setRole(profile.role);

			const { data: company } = await supabase
				.from("onshift_companies")
				.select("name, invite_code")
				.eq("id", profile.company_id)
				.single();

			if (company) {
				setCompanyName(company.name);
				setInviteCode(company.invite_code);
			}
		}

		setLoading(false);
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		navigate("/");
	}

	return (
		<div class="p-10 text-xl">
			
			<Show when={!loading()} fallback={<div class="text-xl">Caricamento...</div>}>

				<div class="space-y-4">
					<h1 class="font-bold text-3xl mb-4">Homepage Dipendente</h1>

					<p><strong>Nome:</strong> {userName()}</p>
					<p><strong>Email:</strong> {userEmail()}</p>
					<p><strong>Ruolo:</strong> {role()}</p>
					<p><strong>Azienda:</strong> {companyName()}</p>
					<p><strong>Invite Code:</strong> {inviteCode()}</p>

					<button
						class="mt-6 bg-red-600 text-white px-4 py-2 rounded-full"
						onClick={handleLogout}
					>
						Logout
					</button>
				</div>

			</Show>
		</div>
	);
}
