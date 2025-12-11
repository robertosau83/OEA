// src/admin/AdminIndex.tsx
import AdminLayout from "./AdminLayout";
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

	let pollingInterval: ReturnType<typeof setInterval> | undefined;

	// ---------------------------------------------------------
	// FUNZIONE DI REFRESH DATI ADMIN
	// ---------------------------------------------------------
	const fetchProfile = async () => {
		const { data: session } = await supabase.auth.getSession();
		const user = session?.session?.user;

		if (!user) {
			navigate("/");
			return;
		}

		if (user.email !== userEmail()) setUserEmail(user.email ?? "");

		// profilo admin
		const { data: profile } = await supabase
			.from("onshift_users")
			.select("name, role, company_id")
			.eq("id", user.id)
			.single();

		if (!profile) return;

		setUserName(profile.name);
		setRole(profile.role);
		setCompanyId(profile.company_id);

		// company info
		const { data: company } = await supabase
			.from("onshift_companies")
			.select("name, invite_code")
			.eq("id", profile.company_id)
			.single();

		if (!company) return;

		setCompanyName(company.name);
		setInviteCode(company.invite_code);
	};

	// ---------------------------------------------------------
	// MOUNT
	// ---------------------------------------------------------
	onMount(async () => {
		await fetchProfile();
		setLoading(false);

		pollingInterval = setInterval(async () => {
			if (document.visibilityState === "visible") {
				await fetchProfile();
			}
		}, 20_000);

		document.addEventListener("visibilitychange", handleVisibilityChange);
	});

	const handleVisibilityChange = () => {
		if (document.visibilityState === "visible") {
			fetchProfile();
		}
	};

	// ---------------------------------------------------------
	// CLEANUP
	// ---------------------------------------------------------
	onCleanup(() => {
		if (pollingInterval) clearInterval(pollingInterval);
		document.removeEventListener("visibilitychange", handleVisibilityChange);
	});

	// ---------------------------------------------------------
	// RENDER
	// ---------------------------------------------------------
	return (
		<AdminLayout
			loading={loading()}
			userName={userName()}
			userEmail={userEmail()}
			role={role()}
			companyName={companyName()}
			inviteCode={inviteCode()}
			companyId={companyId()}
		/>
	);
}
