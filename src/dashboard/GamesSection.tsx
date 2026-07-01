import { For, Show, createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, CloseIcon, QuickInputIcon, TrashIcon } from "./icons";
import type { Game, GamePlayer, OeaUser, QuickPreviewItem, Voice } from "./types";

interface GamesSectionProps {
	isLandscape: Accessor<boolean>;
	saving: Accessor<boolean>;
	activeUsers: Accessor<OeaUser[]>;
	games: Accessor<Game[]>;
	selectedGameId: Accessor<string>;
	selectedGame: Accessor<Game | undefined>;
	isDetailPage: Accessor<boolean>;
	players: Accessor<GamePlayer[]>;
	activeVoices: Accessor<Voice[]>;
	totals: Accessor<Record<string, number>>;
	playedAt: Accessor<string>;
	setPlayedAt: Setter<string>;
	onRecord: Accessor<boolean>;
	setOnRecord: Setter<boolean>;
	notes: Accessor<string>;
	setNotes: Setter<string>;
	selectedUserIds: Accessor<string[]>;
	toggleUser: (userId: string) => void;
	moveSelectedUser: (userId: string, direction: -1 | 1) => void;
	createGame: () => Promise<boolean>;
	selectGame: (gameId: string) => void;
	backToGames: () => void;
	deleteGame: (gameId: string) => void;
	getScore: (userId: string, voiceId: string) => number | "";
	saveScore: (userId: string, voiceId: string, value: string) => void;
	openQuickInput: (player: GamePlayer) => void;
	quickPlayer: Accessor<GamePlayer | null>;
	quickInput: Accessor<string>;
	setQuickInput: Setter<string>;
	appendQuickKey: (key: string) => void;
	backspaceQuickInput: () => void;
	closeQuickInput: () => void;
	quickPreview: Accessor<QuickPreviewItem[]>;
	quickTotal: Accessor<number>;
	quickValuesCount: Accessor<number>;
	quickSaving: Accessor<boolean>;
	applyQuickScores: () => void;
}

export default function GamesSection(props: GamesSectionProps) {
	const [newGameOpen, setNewGameOpen] = createSignal(false);
	const selectedPlayers = () =>
		props.selectedUserIds()
			.map((userId) => props.activeUsers().find((user) => user.id === userId))
			.filter((user): user is OeaUser => Boolean(user));

	const submitNewGame = async () => {
		const created = await props.createGame();
		if (created) setNewGameOpen(false);
	};

	const NewGame = () => (
		<section>
			<div class="mb-4 flex items-center justify-between gap-3">
				<h2 class="text-lg font-bold text-gray-900">Nuova partita</h2>
				<button
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700"
					aria-label="Chiudi nuova partita"
					onClick={() => setNewGameOpen(false)}
				>
					<CloseIcon />
				</button>
			</div>

			<label class="mb-3 block">
				<span class="mb-1 block text-sm font-medium text-gray-600">Data</span>
				<input
					type="date"
					class="h-11 w-full rounded border border-gray-300 px-3"
					value={props.playedAt()}
					onInput={(event) => props.setPlayedAt(event.currentTarget.value)}
				/>
			</label>

			<label class="mb-3 flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-3">
				<span>
					<span class="block text-sm font-medium text-gray-900">On record</span>
					<span class="block text-xs text-gray-500">Marca questa partita nello storico ufficiale.</span>
				</span>
				<input
					type="checkbox"
					class="h-5 w-5"
					checked={props.onRecord()}
					onChange={(event) => props.setOnRecord(event.currentTarget.checked)}
				/>
			</label>

			<label class="mb-4 block">
				<span class="mb-1 block text-sm font-medium text-gray-600">Note</span>
				<textarea
					class="min-h-20 w-full rounded border border-gray-300 px-3 py-2"
					value={props.notes()}
					onInput={(event) => props.setNotes(event.currentTarget.value)}
				/>
			</label>

			<div class="mb-4">
				<span class="mb-2 block text-sm font-medium text-gray-600">Giocatori</span>
				<div class="space-y-2">
					<For each={props.activeUsers()}>
						{(user) => (
							<label class="flex items-center gap-3 rounded border border-gray-200 px-3 py-2">
								<input
									type="checkbox"
									class="h-5 w-5"
									checked={props.selectedUserIds().includes(user.id)}
									onChange={() => props.toggleUser(user.id)}
								/>
								<span class="min-w-0">
									<span class="block truncate text-sm font-medium text-gray-900">{user.name}</span>
									<span class="block truncate text-xs text-gray-500">{user.email}</span>
								</span>
							</label>
						)}
					</For>
				</div>
			</div>

			<Show when={selectedPlayers().length > 0}>
				<div class="mb-4">
					<span class="mb-2 block text-sm font-medium text-gray-600">Ordine inserimento</span>
					<div class="space-y-2">
						<For each={selectedPlayers()}>
							{(user, index) => (
								<div class="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2">
									<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-600">
										{index() + 1}
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-semibold text-gray-900">{user.name}</span>
										<span class="block truncate text-xs text-gray-500">{user.email}</span>
									</span>
									<button
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-700 disabled:opacity-30"
										title="Sposta su"
										aria-label={`Sposta su ${user.name}`}
										disabled={index() === 0}
										onClick={() => props.moveSelectedUser(user.id, -1)}
									>
										<ArrowUpIcon />
									</button>
									<button
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-700 disabled:opacity-30"
										title="Sposta giu"
										aria-label={`Sposta giu ${user.name}`}
										disabled={index() === selectedPlayers().length - 1}
										onClick={() => props.moveSelectedUser(user.id, 1)}
									>
										<ArrowDownIcon />
									</button>
								</div>
							)}
						</For>
					</div>
				</div>
			</Show>

			<button
				class="h-11 w-full rounded-full bg-[#0551b5] px-4 font-semibold text-white disabled:opacity-60"
				disabled={props.saving()}
				onClick={submitNewGame}
			>
				{props.saving() ? "Salvataggio..." : "Crea partita"}
			</button>
		</section>
	);

	const GameList = () => (
		<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-base font-semibold text-gray-900">Partite</h2>

			<div class="space-y-2">
				<For each={props.games()} fallback={<p class="text-sm text-gray-500">Nessuna partita salvata.</p>}>
					{(game) => (
						<div
							class={`flex items-stretch gap-2 rounded border ${
								props.selectedGameId() === game.id ? "border-[#0551b5] bg-blue-50" : "border-gray-200 bg-white"
							}`}
						>
							<button class="min-w-0 flex-1 px-3 py-3 text-left" onClick={() => props.selectGame(game.id)}>
								<span class="flex items-center gap-2 text-sm font-semibold text-gray-900">
									{game.played_at}
									<Show when={game.on_record}>
										<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">On record</span>
									</Show>
								</span>
								<span class="mt-1 block truncate text-xs text-gray-500">{game.player_names.join(", ")}</span>
							</button>

							<button
								class="flex w-11 items-center justify-center rounded-r text-red-600 hover:bg-red-50"
								title="Elimina partita"
								aria-label="Elimina partita"
								onClick={() => props.deleteGame(game.id)}
							>
								<TrashIcon />
							</button>
						</div>
					)}
				</For>
			</div>
		</section>
	);

	const GameDetail = () => (
		<section class="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<Show when={props.selectedGame()} fallback={<p class="text-gray-500">Seleziona o crea una partita.</p>}>
				<button
					class="mb-4 flex h-10 items-center gap-2 rounded-full bg-blue-50 px-3 text-sm font-semibold text-[#0551b5]"
					onClick={props.backToGames}
					aria-label="Torna alle partite"
				>
					<ArrowLeftIcon />
					<span>Torna</span>
				</button>

				<div class="mb-4">
					<div class="flex flex-wrap items-center gap-2">
						<h2 class="text-base font-semibold text-gray-900">Dettaglio partita</h2>
						<Show when={props.selectedGame()?.on_record}>
							<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">On record</span>
						</Show>
					</div>
					<p class="text-sm text-gray-500">
						{props.selectedGame()?.played_at}
						{props.selectedGame()?.notes ? ` - ${props.selectedGame()?.notes}` : ""}
					</p>
				</div>

				<div class={props.isLandscape() ? "overflow-x-auto" : "overflow-x-hidden"}>
					<table class={props.isLandscape() ? "w-full min-w-[620px] border-collapse text-sm" : "w-full table-fixed border-collapse text-[11px]"}>
						<thead>
							<tr>
								<th class={props.isLandscape() ? "sticky left-0 bg-white p-2 text-left font-semibold text-gray-600" : "w-[32%] bg-white px-1 py-2 text-left font-semibold text-gray-600"}>Voce</th>
								<For each={props.players()}>
									{(player) => (
										<th class={props.isLandscape() ? "border-b border-gray-200 p-2 text-left font-semibold text-gray-900" : "border-b border-gray-200 px-1 py-2 text-center font-semibold text-gray-900"}>
											<button
												class="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#0551b5]"
												title="Inserimento rapido"
												aria-label={`Inserimento rapido ${player.name}`}
												onClick={() => props.openQuickInput(player)}
											>
												<QuickInputIcon />
											</button>
											<span class="block truncate">{player.name}</span>
										</th>
									)}
								</For>
							</tr>
						</thead>

						<tbody>
							<For each={props.activeVoices()}>
								{(voice) => (
									<tr>
										<td class={props.isLandscape() ? "sticky left-0 border-b border-gray-100 bg-white p-2 font-medium text-gray-700" : "border-b border-gray-100 bg-white px-1 py-2 font-medium leading-tight text-gray-700"}>
											{voice.name}
										</td>
										<For each={props.players()}>
											{(player) => (
												<td class={props.isLandscape() ? "border-b border-gray-100 p-2" : "border-b border-gray-100 px-1 py-2"}>
													<input
														type="number"
														class={props.isLandscape() ? "h-10 w-20 rounded border border-gray-300 px-2 text-right" : "h-9 w-full min-w-0 rounded border border-gray-300 px-1 text-center text-sm"}
														value={props.getScore(player.user_id, voice.id)}
														onInput={(event) => props.saveScore(player.user_id, voice.id, event.currentTarget.value)}
													/>
												</td>
											)}
										</For>
									</tr>
								)}
							</For>

							<tr>
								<td class={props.isLandscape() ? "sticky left-0 bg-white p-2 font-bold text-gray-900" : "bg-white px-1 py-2 font-bold text-gray-900"}>Totale</td>
								<For each={props.players()}>
									{(player) => (
										<td class={props.isLandscape() ? "p-2 text-right text-base font-bold text-gray-900" : "px-1 py-2 text-center text-sm font-bold text-gray-900"}>
											{props.totals()[player.user_id] ?? 0}
										</td>
									)}
								</For>
							</tr>
						</tbody>
					</table>
				</div>
			</Show>
		</section>
	);

	const QuickScoreModal = () => (
		<Show when={props.quickPlayer()}>
			<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2">
				<div class="flex max-h-[96vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
					<div class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
						<div class="min-w-0">
							<h2 class="truncate text-lg font-bold text-gray-900">Inserimento rapido</h2>
							{/* <p class="truncate text-sm text-gray-500">{props.quickPlayer()?.name}</p> */}
						</div>
						<button class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700" aria-label="Chiudi inserimento rapido" onClick={props.closeQuickInput}>
							<CloseIcon />
						</button>
					</div>

					<div class="min-h-0 flex-1 overflow-y-auto p-3">
						<div class="grid min-h-0 grid-cols-[minmax(0,1fr)_100px] items-stretch gap-3">
							<div class="flex min-h-0 min-w-0 flex-col gap-2">
								<textarea
									rows="2"
									class={`min-h-[64px] w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-right font-semibold leading-tight ${props.quickInput().length > 24 ? "text-sm" : "text-lg"}`}
									value={props.quickInput()}
									placeholder="23/15/16"
									onInput={(event) => props.setQuickInput(event.currentTarget.value)}
								/>

								<div class="grid min-h-0 flex-1 grid-cols-3 grid-rows-5 gap-2">
									<For each={["7", "8", "9", "4", "5", "6", "1", "2", "3"]}>
										{(key) => (
											<button class="h-full min-h-12 rounded-full bg-gray-100 text-xl font-semibold text-gray-900 active:bg-gray-200" onClick={() => props.appendQuickKey(key)}>
												{key}
											</button>
										)}
									</For>
									<button class="h-full min-h-12 rounded-full bg-gray-200 text-lg font-semibold text-gray-900 active:bg-gray-300" onClick={() => props.setQuickInput("")}>C</button>
									<button class="h-full min-h-12 rounded-full bg-gray-100 text-xl font-semibold text-gray-900 active:bg-gray-200" onClick={() => props.appendQuickKey("0")}>0</button>
									<button class="h-full min-h-12 rounded-full bg-gray-200 text-sm font-semibold text-gray-900 active:bg-gray-300" onClick={props.backspaceQuickInput}>Del</button>
									<button class="h-full min-h-12 rounded-full bg-gray-200 text-2xl font-semibold text-gray-900 active:bg-gray-300" onClick={() => props.appendQuickKey("-")}>-</button>
									<button class="col-span-2 h-full min-h-12 rounded-full bg-[#0551b5] text-2xl font-semibold text-white active:bg-blue-800" onClick={() => props.appendQuickKey("/")}>/</button>
								</div>
							</div>

							<div class="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-gray-50 py-2">
								{/* <div class="mb-2 shrink-0 text-center text-xs font-bold uppercase text-gray-500">Preview</div> */}
								<div class="min-h-0 flex-1 space-y-[4px] overflow-y-auto pr-1">
									<For each={props.quickPreview()}>
										{(item) => (
											<div class={`flex items-center justify-between rounded bg-white px-2 text-xs ${item.voice.counts_in_total ? "" : "opacity-60"}`}>
												<span class="min-w-0 truncate text-gray-600">{item.voice.name}</span>
												<span class="shrink-0 font-semibold text-gray-900">{item.score ?? "-"}</span>
											</div>
										)}
									</For>
								</div>
								<div class="flex justify-between items-center mt-2 shrink-0 rounded-lg bg-white px-2 py-2 text-center">
									<div class="flex h-full items-center text-[11px] font-semibold uppercase text-gray-500">TOT</div>
									<div class="text-xl font-bold text-gray-900">{props.quickTotal()}</div>
								</div>
							</div>
						</div>

						<Show when={props.quickValuesCount() > props.activeVoices().length}>
							<p class="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700">Hai inserito piu' punteggi delle voci attive: quelli in eccesso saranno ignorati.</p>
						</Show>
					</div>

					<div class="flex shrink-0 gap-2 border-t border-gray-200 p-3">
						<button class="h-11 flex-1 rounded-full border border-gray-300 font-semibold text-gray-700" onClick={props.closeQuickInput}>Annulla</button>
						<button class="h-11 flex-1 rounded-full bg-[#0551b5] font-semibold text-white disabled:opacity-60" disabled={props.quickSaving()} onClick={props.applyQuickScores}>
							{props.quickSaving() ? "Salvataggio..." : "Applica"}
						</button>
					</div>
				</div>
			</div>
		</Show>
	);

	return (
		<>
			<Show
				when={props.isDetailPage()}
				fallback={
					<>
						<div class="space-y-4">
							<GameList />
						</div>

						<button
							class="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#0551b5] text-3xl font-light leading-none text-white shadow-lg active:bg-blue-800"
							aria-label="Crea nuova partita"
							title="Crea nuova partita"
							onClick={() => setNewGameOpen(true)}
						>
							+
						</button>
					</>
				}
			>
				<Show
					when={props.selectedGame() && props.players().length > 0}
					fallback={
						<section class="rounded-lg border border-gray-200 bg-white p-4 text-gray-500 shadow-sm">
							<button
								class="mb-4 flex h-10 items-center gap-2 rounded-full bg-blue-50 px-3 text-sm font-semibold text-[#0551b5]"
								onClick={props.backToGames}
								aria-label="Torna alle partite"
							>
								<ArrowLeftIcon />
								<span>Torna</span>
							</button>
							Caricamento partita...
						</section>
					}
				>
					<GameDetail />
				</Show>
			</Show>

			<Show when={newGameOpen()}>
				<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
					<div class="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
						<NewGame />
					</div>
				</div>
			</Show>

			<QuickScoreModal />
		</>
	);
}
