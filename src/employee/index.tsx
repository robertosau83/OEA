// src/admin/index.tsx
import EmployeeLayout from "./EmployeeLayout";
import EmployeeHome from "./EmployeeHome";
import { createSignal, onMount } from "solid-js";
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
	const [status, setStatus] = createSignal("");

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
			.select("name, role, company_id, status")
			.eq("id", user.id)
			.single();

		if (profile) {
			setUserName(profile.name);
			setRole(profile.role);
			setCompanyId(profile.company_id);
			setStatus(profile.status);

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
