import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useOrientation } from "../context/OrientationContext";
import { supabase } from "../supabaseClient";

interface OeaUser {
	id: string;
	name: string;
	email: string;
	status: string;
	is_admin: boolean;
}

interface Voice {
	id: string;
	code: string;
	name: string;
	sort_order: number;
	is_active: boolean;
	counts_in_total: boolean;
}

interface Game {
	id: string;
	played_at: string;
	on_record: boolean;
	notes: string | null;
	created_by: string;
	created_at: string;
	creator_name: string;
	player_names: string[];
}

interface GamePlayer {
	user_id: string;
	player_order: number;
	name: string;
	email: string;
}

interface Score {
	user_id: string;
	voice_id: string;
	score: number | null;
}

type Section = "games" | "voices" | "users";

function MenuIcon() {
	return (
		<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
		</svg>
	);
}

function TrashIcon() {
	return (
		<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" stroke-linecap="round" stroke-linejoin="round" />
			<path d="M10 10v6M14 10v6" stroke-linecap="round" />
		</svg>
	);
}

function ArrowUpIcon() {
	return (
		<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	);
}

function ArrowDownIcon() {
	return (
		<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 5v14M18 13l-6 6-6-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
		</svg>
	);
}

function EditIcon() {
	return (
		<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 20h9" stroke-linecap="round" />
			<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	);
}

const slugify = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

export default function Dashboard() {
	const navigate = useNavigate();
	const { isLandscape } = useOrientation();

	const [loading, setLoading] = createSignal(true);
	const [saving, setSaving] = createSignal(false);
	const [message, setMessage] = createSignal("");
	const [activeSection, setActiveSection] = createSignal<Section>("games");
	const [drawerOpen, setDrawerOpen] = createSignal(false);

	const [currentUser, setCurrentUser] = createSignal<OeaUser | null>(null);
	const [users, setUsers] = createSignal<OeaUser[]>([]);
	const [voices, setVoices] = createSignal<Voice[]>([]);
	const [games, setGames] = createSignal<Game[]>([]);
	const [selectedGameId, setSelectedGameId] = createSignal<string>("");
	const [players, setPlayers] = createSignal<GamePlayer[]>([]);
	const [scores, setScores] = createSignal<Score[]>([]);

	const [playedAt, setPlayedAt] = createSignal(new Date().toISOString().slice(0, 10));
	const [onRecord, setOnRecord] = createSignal(false);
	const [notes, setNotes] = createSignal("");
	const [selectedUserIds, setSelectedUserIds] = createSignal<string[]>([]);

	const [newVoiceName, setNewVoiceName] = createSignal("");
	const [editingVoiceId, setEditingVoiceId] = createSignal("");
	const [editingVoiceName, setEditingVoiceName] = createSignal("");

	const activeVoices = createMemo(() =>
		voices()
			.filter((voice) => voice.is_active)
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order)
	);
	const activeUsers = createMemo(() => users().filter((user) => user.status === "ACTIVE"));

	onMount(async () => {
		const { data: sessionData } = await supabase.auth.getSession();
		const authUser = sessionData.session?.user;

		if (!authUser) {
			navigate("/");
			return;
		}

		const { data: profile, error: profileError } = await supabase
			.from("oea_users")
			.select("id, name, email, status, is_admin")
			.eq("id", authUser.id)
			.maybeSingle();

		if (profileError || !profile || profile.status !== "ACTIVE") {
			await supabase.auth.signOut();
			navigate("/");
			return;
		}

		setCurrentUser(profile as OeaUser);
		setSelectedUserIds([authUser.id]);
		await loadBaseData();
		setLoading(false);
	});

	const loadBaseData = async () => {
		setMessage("");

		let usersQuery = supabase
			.from("oea_users")
			.select("id, name, email, status, is_admin")
			.order("name", { ascending: true });

		if (!currentUser()?.is_admin) {
			usersQuery = usersQuery.eq("status", "ACTIVE");
		}

		const [{ data: usersData, error: usersError }, { data: voicesData, error: voicesError }] = await Promise.all([
			usersQuery,
			supabase
				.from("oea_voices")
				.select("id, code, name, sort_order, is_active, counts_in_total")
				.order("sort_order", { ascending: true }),
		]);

		if (usersError || voicesError) {
			setMessage("Errore nel caricamento dei dati iniziali.");
			return;
		}

		setUsers((usersData ?? []) as OeaUser[]);
		setVoices((voicesData ?? []) as Voice[]);
		await loadGames();
	};

	const loadGames = async () => {
		const { data, error } = await supabase
			.from("oea_games")
			.select(`
				id,
				played_at,
				on_record,
				notes,
				created_by,
				created_at,
				creator:oea_users!oea_games_created_by_fkey(name),
				players:oea_game_players(
					player_order,
					user:oea_users(name)
				)
			`)
			.order("played_at", { ascending: false })
			.order("created_at", { ascending: false });

		if (error) {
			setMessage("Errore nel caricamento delle partite.");
			return;
		}

		const mapped = ((data ?? []) as any[]).map((game) => ({
			id: game.id,
			played_at: game.played_at,
			on_record: Boolean(game.on_record),
			notes: game.notes,
			created_by: game.created_by,
			created_at: game.created_at,
			creator_name: game.creator?.name ?? "",
			player_names: (game.players ?? [])
				.slice()
				.sort((a: any, b: any) => a.player_order - b.player_order)
				.map((player: any) => player.user?.name)
				.filter(Boolean),
		}));

		setGames(mapped);

		if (selectedGameId() && !mapped.some((game) => game.id === selectedGameId())) {
			setSelectedGameId("");
			setPlayers([]);
			setScores([]);
		}

		if (!selectedGameId() && mapped.length > 0) {
			await selectGame(mapped[0].id);
		}
	};

	const selectGame = async (gameId: string) => {
		setSelectedGameId(gameId);
		setMessage("");

		const [{ data: playerData, error: playerError }, { data: scoreData, error: scoreError }] = await Promise.all([
			supabase
				.from("oea_game_players")
				.select("user_id, player_order, user:oea_users(id, name, email)")
				.eq("game_id", gameId)
				.order("player_order", { ascending: true }),
			supabase
				.from("oea_scores")
				.select("user_id, voice_id, score")
				.eq("game_id", gameId),
		]);

		if (playerError || scoreError) {
			setMessage("Errore nel caricamento della partita.");
			return;
		}

		setPlayers(
			((playerData ?? []) as any[]).map((player) => ({
				user_id: player.user_id,
				player_order: player.player_order,
				name: player.user?.name ?? "",
				email: player.user?.email ?? "",
			}))
		);
		setScores((scoreData ?? []) as Score[]);
		setActiveSection("games");
		setDrawerOpen(false);
	};

	const toggleUser = (userId: string) => {
		setSelectedUserIds((current) =>
			current.includes(userId)
				? current.filter((id) => id !== userId)
				: [...current, userId]
		);
	};

	const createGame = async () => {
		setMessage("");

		if (selectedUserIds().length < 2) {
			setMessage("Seleziona almeno due giocatori.");
			return;
		}

		if (activeVoices().length === 0) {
			setMessage("Prima attiva almeno una voce di punteggio.");
			return;
		}

		const user = currentUser();
		if (!user) return;

		setSaving(true);

		const { data: game, error: gameError } = await supabase
			.from("oea_games")
			.insert({
				played_at: playedAt(),
				on_record: onRecord(),
				notes: notes().trim() || null,
				created_by: user.id,
			})
			.select("id")
			.single();

		if (gameError || !game) {
			setSaving(false);
			setMessage("Errore nella creazione della partita.");
			return;
		}

		const playerRows = selectedUserIds().map((userId, index) => ({
			game_id: game.id,
			user_id: userId,
			player_order: index + 1,
		}));

		const { error: playersError } = await supabase
			.from("oea_game_players")
			.insert(playerRows);

		if (playersError) {
			setSaving(false);
			setMessage("Errore nel salvataggio dei giocatori.");
			return;
		}

		const scoreRows = playerRows.flatMap((player) =>
			activeVoices().map((voice) => ({
				game_id: game.id,
				user_id: player.user_id,
				voice_id: voice.id,
				score: null,
			}))
		);

		const { error: scoresError } = await supabase
			.from("oea_scores")
			.insert(scoreRows);

		if (scoresError) {
			setSaving(false);
			setMessage("Errore nella preparazione dei punteggi.");
			return;
		}

		setNotes("");
		setOnRecord(false);
		setSaving(false);
		await loadGames();
		await selectGame(game.id);
	};

	const deleteGame = async (gameId: string) => {
		const game = games().find((item) => item.id === gameId);
		const label = game ? `${game.played_at} - ${game.player_names.join(", ")}` : "questa partita";

		if (!window.confirm(`Eliminare definitivamente ${label}?`)) return;

		const { error } = await supabase
			.from("oea_games")
			.delete()
			.eq("id", gameId);

		if (error) {
			setMessage("Errore nell'eliminazione della partita.");
			return;
		}

		await loadGames();
	};

	const createVoice = async () => {
		const name = newVoiceName().trim();
		const code = slugify(name);

		if (!name || !code) {
			setMessage("Inserisci un nome valido per la voce.");
			return;
		}

		const nextOrder = Math.max(0, ...voices().map((voice) => voice.sort_order)) + 10;
		const { error } = await supabase
			.from("oea_voices")
			.insert({
				code,
				name,
				sort_order: nextOrder,
				is_active: true,
				counts_in_total: true,
			});

		if (error) {
			setMessage("Errore nella creazione della voce. Verifica che non esista gia'.");
			return;
		}

		setNewVoiceName("");
		await loadBaseData();
	};

	const toggleVoice = async (voice: Voice) => {
		const { error } = await supabase
			.from("oea_voices")
			.update({ is_active: !voice.is_active })
			.eq("id", voice.id);

		if (error) {
			setMessage("Errore nell'aggiornamento della voce.");
			return;
		}

		setVoices((current) =>
			current.map((item) =>
				item.id === voice.id ? { ...item, is_active: !voice.is_active } : item
			)
		);
	};

	const toggleVoiceCountsInTotal = async (voice: Voice) => {
		const { error } = await supabase
			.from("oea_voices")
			.update({ counts_in_total: !voice.counts_in_total })
			.eq("id", voice.id);

		if (error) {
			setMessage("Errore nell'aggiornamento della voce.");
			return;
		}

		setVoices((current) =>
			current.map((item) =>
				item.id === voice.id ? { ...item, counts_in_total: !voice.counts_in_total } : item
			)
		);
	};

	const startEditVoice = (voice: Voice) => {
		setEditingVoiceId(voice.id);
		setEditingVoiceName(voice.name);
	};

	const saveVoiceName = async (voice: Voice) => {
		const name = editingVoiceName().trim();

		if (!name) {
			setMessage("Il nome della voce non puo' essere vuoto.");
			return;
		}

		const { error } = await supabase
			.from("oea_voices")
			.update({ name })
			.eq("id", voice.id);

		if (error) {
			setMessage("Errore nel salvataggio della voce.");
			return;
		}

		setVoices((current) =>
			current.map((item) =>
				item.id === voice.id ? { ...item, name } : item
			)
		);
		setEditingVoiceId("");
		setEditingVoiceName("");
	};

	const moveVoice = async (voiceId: string, direction: -1 | 1) => {
		const ordered = voices().slice().sort((a, b) => a.sort_order - b.sort_order);
		const index = ordered.findIndex((voice) => voice.id === voiceId);
		const targetIndex = index + direction;

		if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

		const current = ordered[index];
		const target = ordered[targetIndex];

		const [{ error: currentError }, { error: targetError }] = await Promise.all([
			supabase
				.from("oea_voices")
				.update({ sort_order: target.sort_order })
				.eq("id", current.id),
			supabase
				.from("oea_voices")
				.update({ sort_order: current.sort_order })
				.eq("id", target.id),
		]);

		if (currentError || targetError) {
			setMessage("Errore nel riordino delle voci.");
			return;
		}

		setVoices((items) =>
			items
				.map((voice) => {
					if (voice.id === current.id) return { ...voice, sort_order: target.sort_order };
					if (voice.id === target.id) return { ...voice, sort_order: current.sort_order };
					return voice;
				})
				.sort((a, b) => a.sort_order - b.sort_order)
		);
	};

	const updateUserStatus = async (user: OeaUser, status: "PENDING" | "ACTIVE" | "DISABLED") => {
		const { error } = await supabase
			.from("oea_users")
			.update({ status })
			.eq("id", user.id);

		if (error) {
			setMessage("Errore nell'aggiornamento dello stato utente.");
			return;
		}

		setUsers((items) =>
			items.map((item) =>
				item.id === user.id ? { ...item, status } : item
			)
		);
	};

	const toggleUserAdmin = async (user: OeaUser) => {
		if (user.id === currentUser()?.id && user.is_admin) {
			setMessage("Non rimuovere il ruolo admin dall'utente corrente.");
			return;
		}

		const { error } = await supabase
			.from("oea_users")
			.update({ is_admin: !user.is_admin })
			.eq("id", user.id);

		if (error) {
			setMessage("Errore nell'aggiornamento del ruolo admin.");
			return;
		}

		setUsers((items) =>
			items.map((item) =>
				item.id === user.id ? { ...item, is_admin: !user.is_admin } : item
			)
		);
	};

	const deleteAuthUser = async (user: OeaUser) => {
		if (user.id === currentUser()?.id) {
			setMessage("Non puoi cancellare l'utente corrente.");
			return;
		}

		if (!window.confirm(`Cancellare definitivamente ${user.email} anche da Supabase Auth?`)) return;

		const { error } = await supabase.rpc("admin_delete_oea_user", {
			target_user_id: user.id,
		});

		if (error) {
			setMessage("Errore cancellazione utente. Se ha partite collegate, disabilitalo invece di cancellarlo.");
			return;
		}

		setUsers((items) => items.filter((item) => item.id !== user.id));
	};

	const getScore = (userId: string, voiceId: string) =>
		scores().find((score) => score.user_id === userId && score.voice_id === voiceId)?.score ?? "";

	const saveScore = async (userId: string, voiceId: string, value: string) => {
		const gameId = selectedGameId();
		const trimmed = value.trim();
		const score = trimmed === "" ? null : Number(trimmed);

		if (!gameId || (score !== null && !Number.isFinite(score))) return;

		setScores((current) => {
			const existing = current.find((item) => item.user_id === userId && item.voice_id === voiceId);
			if (existing) {
				return current.map((item) =>
					item.user_id === userId && item.voice_id === voiceId ? { ...item, score } : item
				);
			}

			return [...current, { user_id: userId, voice_id: voiceId, score }];
		});

		const { error } = await supabase
			.from("oea_scores")
			.upsert({
				game_id: gameId,
				user_id: userId,
				voice_id: voiceId,
				score,
			}, {
				onConflict: "game_id,user_id,voice_id",
			});

		if (error) {
			setMessage("Errore nel salvataggio del punteggio.");
		}
	};

	const totals = createMemo(() => {
		const result: Record<string, number> = {};

		for (const player of players()) {
			result[player.user_id] = scores()
				.filter((score) => {
					const voice = voices().find((item) => item.id === score.voice_id);
					return score.user_id === player.user_id && score.score !== null && voice?.counts_in_total !== false;
				})
				.reduce((sum, score) => sum + Number(score.score), 0);
		}

		return result;
	});

	const selectedGame = createMemo(() => games().find((game) => game.id === selectedGameId()));

	const switchSection = (section: Section) => {
		setActiveSection(section);
		setDrawerOpen(false);
	};

	const logout = async () => {
		await supabase.auth.signOut();
		navigate("/");
	};

	const Nav = () => (
		<nav class="space-y-2">
			<button
				class={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold ${
					activeSection() === "games" ? "bg-[#0551b5] text-white" : "text-gray-700 hover:bg-gray-100"
				}`}
				onClick={() => switchSection("games")}
			>
				Partite
			</button>
			<button
				class={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold ${
					activeSection() === "voices" ? "bg-[#0551b5] text-white" : "text-gray-700 hover:bg-gray-100"
				}`}
				onClick={() => switchSection("voices")}
			>
				Voci
			</button>
			<Show when={currentUser()?.is_admin}>
				<button
					class={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold ${
						activeSection() === "users" ? "bg-[#0551b5] text-white" : "text-gray-700 hover:bg-gray-100"
					}`}
					onClick={() => switchSection("users")}
				>
					Utenti
				</button>
			</Show>
		</nav>
	);

	const GameList = () => (
		<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="mb-3 text-base font-semibold text-gray-900">Partite</h2>

			<div class="space-y-2">
				<For each={games()} fallback={<p class="text-sm text-gray-500">Nessuna partita salvata.</p>}>
					{(game) => (
						<div
							class={`flex items-stretch gap-2 rounded border ${
								selectedGameId() === game.id ? "border-[#0551b5] bg-blue-50" : "border-gray-200 bg-white"
							}`}
						>
							<button
								class="min-w-0 flex-1 px-3 py-3 text-left"
								onClick={() => selectGame(game.id)}
							>
								<span class="flex items-center gap-2 text-sm font-semibold text-gray-900">
									{game.played_at}
									<Show when={game.on_record}>
										<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
											On record
										</span>
									</Show>
								</span>
								<span class="mt-1 block truncate text-xs text-gray-500">{game.player_names.join(", ")}</span>
							</button>

							<button
								class="flex w-11 items-center justify-center rounded-r text-red-600 hover:bg-red-50"
								title="Elimina partita"
								aria-label="Elimina partita"
								onClick={() => deleteGame(game.id)}
							>
								<TrashIcon />
							</button>
						</div>
					)}
				</For>
			</div>
		</section>
	);

	const NewGame = () => (
		<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="mb-4 text-base font-semibold text-gray-900">Nuova partita</h2>

			<label class="mb-3 block">
				<span class="mb-1 block text-sm font-medium text-gray-600">Data</span>
				<input
					type="date"
					class="h-11 w-full rounded border border-gray-300 px-3"
					value={playedAt()}
					onInput={(event) => setPlayedAt(event.currentTarget.value)}
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
					checked={onRecord()}
					onChange={(event) => setOnRecord(event.currentTarget.checked)}
				/>
			</label>

			<label class="mb-4 block">
				<span class="mb-1 block text-sm font-medium text-gray-600">Note</span>
				<textarea
					class="min-h-20 w-full rounded border border-gray-300 px-3 py-2"
					value={notes()}
					onInput={(event) => setNotes(event.currentTarget.value)}
				/>
			</label>

			<div class="mb-4">
				<span class="mb-2 block text-sm font-medium text-gray-600">Giocatori</span>
				<div class="space-y-2">
					<For each={activeUsers()}>
						{(user) => (
							<label class="flex items-center gap-3 rounded border border-gray-200 px-3 py-2">
								<input
									type="checkbox"
									class="h-5 w-5"
									checked={selectedUserIds().includes(user.id)}
									onChange={() => toggleUser(user.id)}
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

			<button
				class="h-11 w-full rounded-full bg-[#0551b5] px-4 font-semibold text-white disabled:opacity-60"
				disabled={saving()}
				onClick={createGame}
			>
				{saving() ? "Salvataggio..." : "Crea partita"}
			</button>
		</section>
	);

	const GameDetail = () => (
		<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<Show when={selectedGame()} fallback={<p class="text-gray-500">Seleziona o crea una partita.</p>}>
				<div class="mb-4">
					<div class="flex flex-wrap items-center gap-2">
						<h2 class="text-base font-semibold text-gray-900">Dettaglio partita</h2>
						<Show when={selectedGame()?.on_record}>
							<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
								On record
							</span>
						</Show>
					</div>
					<p class="text-sm text-gray-500">
						{selectedGame()?.played_at}
						{selectedGame()?.notes ? ` - ${selectedGame()?.notes}` : ""}
					</p>
				</div>

				<div class={isLandscape() ? "overflow-x-auto" : "overflow-x-hidden"}>
					<table class={isLandscape() ? "w-full min-w-[620px] border-collapse text-sm" : "w-full table-fixed border-collapse text-[11px]"}>
						<thead>
							<tr>
								<th class={isLandscape()
									? "sticky left-0 bg-white p-2 text-left font-semibold text-gray-600"
									: "w-[32%] bg-white px-1 py-2 text-left font-semibold text-gray-600"}
								>
									Voce
								</th>
								<For each={players()}>
									{(player) => (
										<th class={isLandscape()
											? "border-b border-gray-200 p-2 text-left font-semibold text-gray-900"
											: "border-b border-gray-200 px-1 py-2 text-center font-semibold text-gray-900"}
										>
											<span class="block truncate">{player.name}</span>
										</th>
									)}
								</For>
							</tr>
						</thead>

						<tbody>
							<For each={activeVoices()}>
								{(voice) => (
									<tr>
										<td class={isLandscape()
											? "sticky left-0 border-b border-gray-100 bg-white p-2 font-medium text-gray-700"
											: "border-b border-gray-100 bg-white px-1 py-2 font-medium leading-tight text-gray-700"}
										>
											{voice.name}
										</td>
										<For each={players()}>
											{(player) => (
												<td class={isLandscape() ? "border-b border-gray-100 p-2" : "border-b border-gray-100 px-1 py-2"}>
													<input
														type="number"
														class={isLandscape()
															? "h-10 w-20 rounded border border-gray-300 px-2 text-right"
															: "h-9 w-full min-w-0 rounded border border-gray-300 px-1 text-center text-sm"}
														value={getScore(player.user_id, voice.id)}
														onInput={(event) => saveScore(player.user_id, voice.id, event.currentTarget.value)}
													/>
												</td>
											)}
										</For>
									</tr>
								)}
							</For>

							<tr>
								<td class={isLandscape()
									? "sticky left-0 bg-white p-2 font-bold text-gray-900"
									: "bg-white px-1 py-2 font-bold text-gray-900"}
								>
									Totale
								</td>
								<For each={players()}>
									{(player) => (
										<td class={isLandscape()
											? "p-2 text-right text-base font-bold text-gray-900"
											: "px-1 py-2 text-center text-sm font-bold text-gray-900"}
										>
											{totals()[player.user_id] ?? 0}
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

	const VoicesSection = () => (
		<div class="space-y-4">
			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-4 text-base font-semibold text-gray-900">Nuova voce</h2>

				<div class="flex gap-2">
					<input
						class="h-11 min-w-0 flex-1 rounded border border-gray-300 px-3"
						placeholder="Nome voce"
						value={newVoiceName()}
						onInput={(event) => setNewVoiceName(event.currentTarget.value)}
						onKeyDown={(event) => event.key === "Enter" && createVoice()}
					/>
					<button
						class="h-11 rounded-full bg-[#0551b5] px-4 text-sm font-semibold text-white"
						onClick={createVoice}
					>
						Aggiungi
					</button>
				</div>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-4 text-base font-semibold text-gray-900">Voci</h2>

				<div class="space-y-2">
					<For each={voices().slice().sort((a, b) => a.sort_order - b.sort_order)}>
						{(voice, index) => (
							<div class={`rounded border border-gray-200 p-3 ${voice.is_active ? "" : "opacity-45"}`}>
								<Show
									when={editingVoiceId() === voice.id}
									fallback={
										<div class="space-y-3">
											<div class="flex items-center gap-3">
												<div class="flex overflow-hidden rounded-full border border-gray-300">
													<button
														class="flex h-8 w-8 items-center justify-center text-gray-700 disabled:opacity-30"
														title="Sposta su"
														aria-label="Sposta voce su"
														disabled={index() === 0}
														onClick={() => moveVoice(voice.id, -1)}
													>
														<ArrowUpIcon />
													</button>
													<button
														class="flex h-8 w-8 items-center justify-center border-l border-gray-300 text-gray-700 disabled:opacity-30"
														title="Sposta giu"
														aria-label="Sposta voce giu"
														disabled={index() === voices().length - 1}
														onClick={() => moveVoice(voice.id, 1)}
													>
														<ArrowDownIcon />
													</button>
												</div>
												<div class="min-w-0 flex-1">
													<p class="truncate text-sm font-semibold text-gray-900">{voice.name}</p>
													<p class="text-xs text-gray-500">
														{voice.code}
														{voice.counts_in_total ? "" : " - fuori totale"}
													</p>
												</div>
											</div>

											<div class="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
												<div class="flex flex-wrap items-center gap-4">
													<label class="flex items-center gap-2 text-xs font-semibold text-gray-700">
														<input
															type="checkbox"
															class="h-4 w-4"
															checked={voice.counts_in_total}
															onChange={() => toggleVoiceCountsInTotal(voice)}
														/>
														Totale
													</label>
													<label class="flex items-center gap-2 text-xs font-semibold text-gray-700">
														<input
															type="checkbox"
															class="h-4 w-4"
															checked={voice.is_active}
															onChange={() => toggleVoice(voice)}
														/>
														Attiva
													</label>
												</div>
												<button
													class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700"
													title="Modifica voce"
													aria-label="Modifica voce"
													onClick={() => startEditVoice(voice)}
												>
													<EditIcon />
												</button>
											</div>
										</div>
									}
								>
									<div class="flex gap-2">
										<input
											class="h-10 min-w-0 flex-1 rounded border border-gray-300 px-3"
											value={editingVoiceName()}
											onInput={(event) => setEditingVoiceName(event.currentTarget.value)}
										/>
										<button
											class="rounded-full bg-[#0551b5] px-3 text-xs font-semibold text-white"
											onClick={() => saveVoiceName(voice)}
										>
											Salva
										</button>
										<button
											class="rounded-full border border-gray-300 px-3 text-xs font-semibold text-gray-700"
											onClick={() => setEditingVoiceId("")}
										>
											Annulla
										</button>
									</div>
								</Show>
							</div>
						)}
					</For>
				</div>
			</section>
		</div>
	);

	const UsersSection = () => (
		<div class="mx-auto max-w-2xl space-y-3">
			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-1 text-base font-semibold text-gray-900">Utenti</h2>
				<p class="mb-4 text-sm text-gray-500">
					La cancellazione rimuove l'utente anche da Supabase Auth. Se l'utente ha storico partite, usa DISABLED.
				</p>

				<div class="space-y-2">
					<For each={users()}>
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
										onClick={() => updateUserStatus(user, "ACTIVE")}
									>
										Attiva
									</button>
									<button
										class="h-9 rounded-full border border-gray-300 text-xs font-semibold text-gray-700 disabled:opacity-40"
										disabled={user.status === "DISABLED"}
										onClick={() => updateUserStatus(user, "DISABLED")}
									>
										Disabilita
									</button>
									<button
										class="h-9 rounded-full border border-red-200 text-xs font-semibold text-red-600 disabled:opacity-40"
										disabled={user.id === currentUser()?.id}
										onClick={() => deleteAuthUser(user)}
									>
										Elimina
									</button>
								</div>

								<label class="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-700">
									<input
										type="checkbox"
										checked={user.is_admin}
										disabled={user.id === currentUser()?.id && user.is_admin}
										onChange={() => toggleUserAdmin(user)}
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

	return (
		<div class="h-screen bg-gray-50 text-gray-900">
			<div class="flex h-full">
				<Show when={isLandscape()}>
					<aside class="w-60 border-r border-gray-200 bg-white p-4">
						<div class="mb-6">
							<h1 class="text-xl font-bold">OEA Yazzi</h1>
							<p class="truncate text-sm text-gray-500">{currentUser()?.name}</p>
						</div>
						<Nav />
						<button
							class="mt-6 w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
							onClick={logout}
						>
							Logout
						</button>
					</aside>
				</Show>

				<div class="flex min-w-0 flex-1 flex-col">
					<header class="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
						<div class="flex min-w-0 items-center gap-3">
							<Show when={!isLandscape()}>
								<button
									class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0551b5]"
									onClick={() => setDrawerOpen(true)}
									aria-label="Apri menu"
								>
									<MenuIcon />
								</button>
							</Show>
							<div class="min-w-0">
								<h1 class="truncate text-lg font-bold">OEA Yazzi</h1>
								<p class="truncate text-xs text-gray-500">
									{activeSection() === "games" ? "Partite" : activeSection() === "voices" ? "Voci" : "Utenti"}
								</p>
							</div>
						</div>

						<Show when={!isLandscape()}>
							<button class="text-sm font-semibold text-red-600" onClick={logout}>
								Logout
							</button>
						</Show>
					</header>

					<Show when={!loading()} fallback={<main class="flex-1 overflow-y-auto p-4 text-gray-600">Caricamento...</main>}>
						<main class="flex-1 overflow-y-auto p-4">
							<Show when={activeSection() === "games"}>
								<div class={isLandscape() ? "grid grid-cols-[340px_1fr] gap-4" : "space-y-4"}>
									<div class="space-y-4">
										<NewGame />
										<GameList />
									</div>
									<GameDetail />
								</div>
							</Show>

							<Show when={activeSection() === "voices"}>
								<div class="mx-auto max-w-2xl">
									<VoicesSection />
								</div>
							</Show>

							<Show when={activeSection() === "users" && currentUser()?.is_admin}>
								<UsersSection />
							</Show>

							{message() && (
								<p class="mt-4 rounded-full bg-red-100 px-4 py-2 text-center text-sm text-red-600">
									{message()}
								</p>
							)}
						</main>
					</Show>
				</div>
			</div>

			<Show when={drawerOpen() && !isLandscape()}>
				<div class="fixed inset-0 z-40 bg-black/40" onClick={() => setDrawerOpen(false)}></div>
				<aside class="fixed inset-y-0 left-0 z-50 w-72 bg-white p-4 shadow-xl">
					<div class="mb-6 flex items-start justify-between gap-4">
						<div class="min-w-0">
							<h2 class="text-xl font-bold">OEA Yazzi</h2>
							<p class="truncate text-sm text-gray-500">{currentUser()?.name}</p>
						</div>
						<button
							class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700"
							onClick={() => setDrawerOpen(false)}
							aria-label="Chiudi menu"
						>
							<CloseIcon />
						</button>
					</div>
					<Nav />
				</aside>
			</Show>
		</div>
	);
}
