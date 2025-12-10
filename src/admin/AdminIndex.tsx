// src/admin/index.tsx

import AdminLayout from "./AdminLayout";
import AdminHome from "./AdminHome";
import EmployeesTab from "./EmployeesTab";
import { createSignal, onMount, onCleanup } from "solid-js";
import { supabase } from "../supabaseClient";
import { useNavigate } from "@solidjs/router";

export default function AdminIndex() {
	const navigate = useNavigate();

	const [loading, setLoading] = createSignal(true);

	const [userName, setUserName] = createSignal("");
	const [userEmail, setUserEmail] = createSignal("");
	const [role, setRole] = createSignal("");
	const [companyName, setCompanyName] = createSignal("");
	const [inviteCode, setInviteCode] = createSignal("");
	const [companyId, setCompanyId] = createSignal("");

	// Polling interval tipizzato correttamente
	let pollingInterval: ReturnType<typeof setInterval> | undefined;

	// ---------------------------------------------------------
	// 🔵 FUNZIONE DI REFRESH DATI ADMIN
	// ---------------------------------------------------------
	const fetchProfile = async () => {
		const { data: session } = await supabase.auth.getSession();
		const user = session?.session?.user;

		if (!user) return;

		// Aggiorno email se serve
		if (user.email !== userEmail()) setUserEmail(user.email ?? "");

		// 1) PROFILO ADMIN
		const { data: profile } = await supabase
			.from("onshift_users")
			.select("name, role, company_id")
			.eq("id", user.id)
			.single();

		if (!profile) return;

		if (profile.name !== userName()) setUserName(profile.name);
		if (profile.role !== role()) setRole(profile.role);
		if (profile.company_id !== companyId()) setCompanyId(profile.company_id);

		// 2) DATI COMPANY
		const { data: company } = await supabase
			.from("onshift_companies")
			.select("name, invite_code")
			.eq("id", profile.company_id)
			.single();

		if (!company) return;

		if (company.name !== companyName()) setCompanyName(company.name);

		//console.log(company.invite_code, inviteCode());

		if (company.invite_code !== inviteCode()) {
			setInviteCode(company.invite_code);
			//console.log(inviteCode());
		}
	};

	// ---------------------------------------------------------
	// 🔵 MOUNT: CARICAMENTO + POLLING + VISIBILITY CHANGE
	// ---------------------------------------------------------
	onMount(async () => {
		await fetchProfile();
		setLoading(false);

		// ⏱️ Soft polling ogni 20 secondi
		pollingInterval = setInterval(async () => {
			if (document.visibilityState === "visible") {
				await fetchProfile();
			}
		}, 20_000);

		// 👁️ Aggiorna subito quando la tab torna visibile
		document.addEventListener("visibilitychange", handleVisibilityChange);
	});

	const handleVisibilityChange = () => {
		if (document.visibilityState === "visible") {
			fetchProfile();
		}
	};

	// ---------------------------------------------------------
	// 🔵 CLEANUP
	// ---------------------------------------------------------
	onCleanup(() => {
		if (pollingInterval) clearInterval(pollingInterval);
		document.removeEventListener("visibilitychange", handleVisibilityChange);
	});

	// ---------------------------------------------------------
	// 🔵 RENDER
	// ---------------------------------------------------------
	return (
		<AdminLayout
			userTab={
				<AdminHome
					loading={loading()}
					userName={userName()}
					setUserName={setUserName}
					userEmail={userEmail()}
					role={role()}
					companyName={companyName()}
					setCompanyName={setCompanyName}
					companyId={companyId()}
					inviteCode={inviteCode()}
				/>
			}
			employeesTab={
				companyId()
					? <EmployeesTab companyId={companyId()} />
					: <div>Caricamento dipendenti...</div>
			}
			userName={userName()}
			companyName={companyName()}
		/>
	);
}
