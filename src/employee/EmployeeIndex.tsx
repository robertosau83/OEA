import EmployeeLayout from "./EmployeeLayout";
import EmployeeHome from "./EmployeeHome";
import { createSignal, onMount, onCleanup } from "solid-js";
import { supabase } from "../supabaseClient";
import { useNavigate } from "@solidjs/router";

export default function EmployeeIndex() {
	const navigate = useNavigate();

	const [loading, setLoading] = createSignal(true);

	const [userName, setUserName] = createSignal("");
	const [userEmail, setUserEmail] = createSignal("");
	const [role, setRole] = createSignal("");
	const [companyName, setCompanyName] = createSignal("");
	const [inviteCode, setInviteCode] = createSignal("");
	const [companyId, setCompanyId] = createSignal("");
	const [status, setStatus] = createSignal("");

	// 👇 compatibile con browser e TS
	let pollingInterval: ReturnType<typeof setInterval> | undefined;

	// -------------------------------------------------
	// 🔵 FUNZIONE DI REFRESH DATI EMPLOYEE
	// -------------------------------------------------
	const fetchProfile = async () => {
		const { data: session } = await supabase.auth.getSession();
		const user = session?.session?.user;
		if (!user) return;

		// 1) Profilo utente
		const { data: profile } = await supabase
			.from("onshift_users")
			.select("name, role, company_id, status")
			.eq("id", user.id)
			.single();

		if (!profile) return;

		if (profile.name !== userName()) setUserName(profile.name);
		if (profile.role !== role()) setRole(profile.role);
		if (profile.company_id !== companyId()) setCompanyId(profile.company_id);
		if (profile.status !== status()) setStatus(profile.status);

		// 2) Dati azienda
		const { data: company } = await supabase
			.from("onshift_companies")
			.select("name, invite_code")
			.eq("id", profile.company_id)
			.single();

		if (!company) return;

		if (company.name !== companyName()) setCompanyName(company.name);
		if (company.invite_code !== inviteCode()) setInviteCode(company.invite_code);
	};

	// -------------------------------------------------
	// 🔵 MOUNT: CARICO DATI + ATTIVO SOFT POLLING
	// -------------------------------------------------
	onMount(async () => {
		// primo caricamento completo
		await fetchProfile();
		setLoading(false);

		// ⏱️ polling ogni 20 sec (solo se tab attiva)
		pollingInterval = setInterval(async () => {
			if (document.visibilityState === "visible") {
				await fetchProfile();
			}
		}, 20_000);

		// 🔥 refresh immediato quando la tab diventa visibile
		document.addEventListener("visibilitychange", handleVisibilityChange);
	});

	// -------------------------------------------------
	// 🔵 HANDLER VISIBILITY
	// -------------------------------------------------
	const handleVisibilityChange = () => {
		if (document.visibilityState === "visible") {
			fetchProfile();
		}
	};

	// -------------------------------------------------
	// 🔵 CLEANUP
	// -------------------------------------------------
	onCleanup(() => {
		if (pollingInterval) clearInterval(pollingInterval);
		document.removeEventListener("visibilitychange", handleVisibilityChange);
	});

	// -------------------------------------------------
	// 🔵 RENDER
	// -------------------------------------------------
	return (
		<EmployeeLayout
			userTab={
				<EmployeeHome
					loading={loading()}
					userName={userName()}
					userEmail={userEmail()}
					role={role()}
					companyName={companyName()}
					companyId={companyId()}
					status={status()}
					inviteCode={inviteCode()}
				/>
			}
			userName={userName()}
			companyName={companyName()}
		/>
	);
}
