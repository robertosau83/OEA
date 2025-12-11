// src/admin/AdminLayout.tsx
import { createSignal, Show, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useOrientation } from "../context/OrientationContext";

import AdminHome from "./AdminHome";
import EmployeesTab from "./EmployeesTab";

interface AdminLayoutProps {
	loading: boolean;
	userName: string;
	userEmail: string;
	role: string;
	companyName: string;
	inviteCode: string;
	companyId: string;
}

export default function AdminLayout(props: AdminLayoutProps) {
	const navigate = useNavigate();
	const { isLandscape } = useOrientation();

	// Stati locali che si aggiornano subito
	const [userName, setUserName] = createSignal(props.userName);
	const [companyName, setCompanyName] = createSignal(props.companyName);

	// Aggiorna stati quando props cambiano (per polling o refresh)
	createEffect(() => {
		setUserName(props.userName);
		setCompanyName(props.companyName);
	});

	const [active, setActive] = createSignal<"employees" | "user">("employees");
	const [sidebarOpen, setSidebarOpen] = createSignal(false);

	function logout() {
		navigate("/");
	}

	const menuItem = (key: "employees" | "user", label: string) => (
		<div
			class={`cursor-pointer px-4 py-3 rounded-lg mb-2 font-semibold 
        ${active() === key ? "bg-[#0551b5] text-white" : "text-gray-700 hover:bg-gray-100"}`}
			onClick={() => {
				setActive(key);
				setSidebarOpen(false);
			}}
		>
			{label}
		</div>
	);

	// 👇 Router interno
	const currentPage = () => {
		if (active() === "employees") {
			if (!props.companyId) {
				return <div>Caricamento dipendenti...</div>;
			}

			return <EmployeesTab companyId={props.companyId} />;
		}

		return (
			<AdminHome
				loading={props.loading}
				userName={userName()}
				setUserName={setUserName} // <-- versione locale immediata
				userEmail={props.userEmail}
				role={props.role}
				companyName={companyName()}
				setCompanyName={setCompanyName} // <-- versione locale immediata
				companyId={props.companyId}
				inviteCode={props.inviteCode}
			/>
		);
	};


	return (
		<div class={isLandscape()
			? "flex h-screen bg-gray-50"
			: "flex flex-col h-screen bg-gray-50 relative"}>

			{/* TOP BAR PORTRAIT */}
			{!isLandscape() && (
				<header class="w-full bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shadow-sm">
					<button class="p-2 rounded-full bg-blue-50" onClick={() => setSidebarOpen(true)}>
						<img src="/menu-blue.svg" class="w-6 h-6" />
					</button>
				</header>
			)}

			{/* SIDEBAR LANDSCAPE */}
			{isLandscape() && (
				<aside class="w-56 bg-white border-r border-gray-200 shadow-sm flex flex-col">
					<div class="py-2 px-6 border-b mb-4">
						<div class="text-xl font-bold text-[#0551b5]">{props.userName}</div>
						<div class="text-xl font-semibold text-[#0551b5] opacity-50">{props.companyName}</div>
					</div>

					<div class="px-2">
						{menuItem("employees", "Dipendenti")}
						{menuItem("user", "Account")}
					</div>

					<div
						class="cursor-pointer px-4 py-3 rounded-lg text-red-600 font-semibold hover:bg-red-50 mt-auto mb-6"
						onClick={logout}
					>
						Logout
					</div>
				</aside>
			)}

			{/* SIDEBAR MOBILE */}
			{!isLandscape() && (
				<>
					<Show when={sidebarOpen()}>
						<div
							class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
							onClick={() => setSidebarOpen(false)}
						></div>
					</Show>

					<div
						class={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform
              ${sidebarOpen() ? "translate-x-0" : "-translate-x-full"}`}
					>
						<div class="py-2 px-6 border-b">
							<div class="text-xl font-bold text-[#0551b5]">{props.userName}</div>
							<div class="text-xl font-semibold text-[#0551b5] opacity-50">{props.companyName}</div>
						</div>

						<div class="py-4 px-2">
							{menuItem("employees", "Dipendenti")}
							{menuItem("user", "Account")}
						</div>

						<div class="absolute bottom-4 left-0 right-0 px-4">
							<button
								class="w-full px-4 py-3 rounded-lg text-red-600 font-semibold hover:bg-red-50"
								onClick={logout}
							>
								Logout
							</button>
						</div>
					</div>
				</>
			)}

			{/* PAGE CONTENT */}
			<main class={isLandscape() ? "flex-1 p-10 overflow-y-auto" : "flex-1 p-4 overflow-y-auto"}>
				{currentPage()}
			</main>

		</div>
	);
}
