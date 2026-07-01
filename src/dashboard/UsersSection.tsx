import { For } from "solid-js";
import type { Accessor } from "solid-js";
import type { OeaUser, UserStatus } from "./types";

interface UsersSectionProps {
	users: Accessor<OeaUser[]>;
	currentUser: Accessor<OeaUser | null>;
	updateUserStatus: (user: OeaUser, status: UserStatus) => void;
	toggleUserAdmin: (user: OeaUser) => void;
	deleteAuthUser: (user: OeaUser) => void;
}

export default function UsersSection(props: UsersSectionProps) {
	return (
		<div class="mx-auto max-w-2xl space-y-3">
			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-1 text-base font-semibold text-gray-900">Utenti</h2>
				<p class="mb-4 text-sm text-gray-500">
					La cancellazione rimuove l'utente anche da Supabase Auth. Se l'utente ha storico partite, usa DISABLED.
				</p>

				<div class="space-y-2">
					<For each={props.users()}>
						{(user) => (
							<div class="rounded border border-gray-200 p-3">
								<div class="mb-3 flex items-start justify-between gap-3">
									<div class="min-w-0">
										<p class="truncate text-sm font-semibold text-gray-900">{user.name}</p>
										<p class="truncate text-xs text-gray-500">{user.email}</p>
									</div>
									<span class={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
										user.status === "ACTIVE"
											? "bg-emerald-100 text-emerald-700"
											: user.status === "PENDING"
												? "bg-yellow-100 text-yellow-700"
												: "bg-gray-100 text-gray-600"
									}`}>
										{user.status}
									</span>
								</div>

								<div class="grid grid-cols-3 gap-2">
									<button
										class="h-9 rounded-full border border-gray-300 text-xs font-semibold text-gray-700 disabled:opacity-40"
										disabled={user.status === "ACTIVE"}
										onClick={() => props.updateUserStatus(user, "ACTIVE")}
									>
										Attiva
									</button>
									<button
										class="h-9 rounded-full border border-gray-300 text-xs font-semibold text-gray-700 disabled:opacity-40"
										disabled={user.status === "DISABLED"}
										onClick={() => props.updateUserStatus(user, "DISABLED")}
									>
										Disabilita
									</button>
									<button
										class="h-9 rounded-full border border-red-200 text-xs font-semibold text-red-600 disabled:opacity-40"
										disabled={user.id === props.currentUser()?.id}
										onClick={() => props.deleteAuthUser(user)}
									>
										Elimina
									</button>
								</div>

								<label class="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-700">
									<input
										type="checkbox"
										checked={user.is_admin}
										disabled={user.id === props.currentUser()?.id && user.is_admin}
										onChange={() => props.toggleUserAdmin(user)}
									/>
									Admin
								</label>
							</div>
						)}
					</For>
				</div>
			</section>
		</div>
	);
}
