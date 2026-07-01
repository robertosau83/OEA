import { Show, createEffect, createMemo, createSignal, onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { useOrientation } from "../context/OrientationContext";
import { supabase } from "../supabaseClient";
import GamesSection from "./GamesSection";
import VoicesSection from "./VoicesSection";
import UsersSection from "./UsersSection";
import { CloseIcon, MenuIcon } from "./icons";
import type { Game, GamePlayer, OeaUser, Score, Section, UserStatus, Voice } from "./types";

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
	const params = useParams();
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
	const [selectedGameId, setSelectedGameId] = createSignal("");
	const [players, setPlayers] = createSignal<GamePlayer[]>([]);
	const [scores, setScores] = createSignal<Score[]>([]);

	const [playedAt, setPlayedAt] = createSignal(new Date().toISOString().slice(0, 10));
	const [onRecord, setOnRecord] = createSignal(false);
	const [notes, setNotes] = createSignal("");
	const [selectedUserIds, setSelectedUserIds] = createSignal<string[]>([]);

	const [newVoiceName, setNewVoiceName] = createSignal("");
	const [editingVoiceId, setEditingVoiceId] = createSignal("");
	const [editingVoiceName, setEditingVoiceName] = createSignal("");

	const [quickPlayerId, setQuickPlayerId] = createSignal("");
	const [quickInput, setQuickInput] = createSignal("");
	const [quickSaving, setQuickSaving] = createSignal(false);

	const activeVoices = createMemo(() =>
		voices()
			.filter((voice) => voice.is_active)
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order)
	);
	const activeUsers = createMemo(() => users().filter((user) => user.status === "ACTIVE"));
	const selectedGame = createMemo(() => games().find((game) => game.id === selectedGameId()));
	const routeGameId = createMemo(() => params.gameId ?? "");
	const isGameDetailPage = createMemo(() => Boolean(routeGameId()));

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

	createEffect(() => {
		if (loading()) return;

		const gameId = routeGameId();
		if (!gameId) {
			if (selectedGameId()) {
				setSelectedGameId("");
				setPlayers([]);
				setScores([]);
				setQuickPlayerId("");
				setQuickInput("");
			}
			return;
		}

		if (gameId !== selectedGameId()) {
			if (!games().some((game) => game.id === gameId)) {
				setSelectedGameId("");
				setPlayers([]);
				setScores([]);
				setMessage("Partita non trovata.");
				return;
			}

			void selectGame(gameId);
		}
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

	const openGameDetail = (gameId: string) => {
		navigate(`/app/games/${gameId}`);
	};

	const backToGames = () => {
		navigate("/app");
	};

	const toggleUser = (userId: string) => {
		setSelectedUserIds((current) =>
			current.includes(userId)
				? current.filter((id) => id !== userId)
				: [...current, userId]
		);
	};

	const moveSelectedUser = (userId: string, direction: -1 | 1) => {
		setSelectedUserIds((current) => {
			const index = current.indexOf(userId);
			const targetIndex = index + direction;

			if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;

			const next = current.slice();
			[next[index], next[targetIndex]] = [next[targetIndex], next[index]];
			return next;
		});
	};

	const createGame = async () => {
		setMessage("");

		if (selectedUserIds().length < 2) {
			setMessage("Seleziona almeno due giocatori.");
			return false;
		}

		if (activeVoices().length === 0) {
			setMessage("Prima attiva almeno una voce di punteggio.");
			return false;
		}

		const user = currentUser();
		if (!user) return false;

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
			return false;
		}

		const playerRows = selectedUserIds().map((userId, index) => ({
			game_id: game.id,
			user_id: userId,
			player_order: index + 1,
		}));

		const { error: playersError } = await supabase.from("oea_game_players").insert(playerRows);

		if (playersError) {
			setSaving(false);
			setMessage("Errore nel salvataggio dei giocatori.");
			return false;
		}

		const scoreRows = playerRows.flatMap((player) =>
			activeVoices().map((voice) => ({
				game_id: game.id,
				user_id: player.user_id,
				voice_id: voice.id,
				score: null,
			}))
		);

		const { error: scoresError } = await supabase.from("oea_scores").insert(scoreRows);

		if (scoresError) {
			setSaving(false);
			setMessage("Errore nella preparazione dei punteggi.");
			return false;
		}

		setNotes("");
		setOnRecord(false);
		setSaving(false);
		await loadGames();
		openGameDetail(game.id);
		return true;
	};

	const deleteGame = async (gameId: string) => {
		const game = games().find((item) => item.id === gameId);
		const label = game ? `${game.played_at} - ${game.player_names.join(", ")}` : "questa partita";

		if (!window.confirm(`Eliminare definitivamente ${label}?`)) return;

		const { error } = await supabase.from("oea_games").delete().eq("id", gameId);

		if (error) {
			setMessage("Errore nell'eliminazione della partita.");
			return;
		}

		await loadGames();
		if (routeGameId() === gameId) {
			backToGames();
		}
	};

	const createVoice = async () => {
		const name = newVoiceName().trim();
		const code = slugify(name);

		if (!name || !code) {
			setMessage("Inserisci un nome valido per la voce.");
			return;
		}

		const nextOrder = Math.max(0, ...voices().map((voice) => voice.sort_order)) + 10;
		const { error } = await supabase.from("oea_voices").insert({
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
		const { error } = await supabase.from("oea_voices").update({ is_active: !voice.is_active }).eq("id", voice.id);

		if (error) {
			setMessage("Errore nell'aggiornamento della voce.");
			return;
		}

		setVoices((current) => current.map((item) => item.id === voice.id ? { ...item, is_active: !voice.is_active } : item));
	};

	const toggleVoiceCountsInTotal = async (voice: Voice) => {
		const { error } = await supabase.from("oea_voices").update({ counts_in_total: !voice.counts_in_total }).eq("id", voice.id);

		if (error) {
			setMessage("Errore nell'aggiornamento della voce.");
			return;
		}

		setVoices((current) => current.map((item) => item.id === voice.id ? { ...item, counts_in_total: !voice.counts_in_total } : item));
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

		const { error } = await supabase.from("oea_voices").update({ name }).eq("id", voice.id);

		if (error) {
			setMessage("Errore nel salvataggio della voce.");
			return;
		}

		setVoices((current) => current.map((item) => item.id === voice.id ? { ...item, name } : item));
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
			supabase.from("oea_voices").update({ sort_order: target.sort_order }).eq("id", current.id),
			supabase.from("oea_voices").update({ sort_order: current.sort_order }).eq("id", target.id),
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

	const updateUserStatus = async (user: OeaUser, status: UserStatus) => {
		const { error } = await supabase.from("oea_users").update({ status }).eq("id", user.id);

		if (error) {
			setMessage("Errore nell'aggiornamento dello stato utente.");
			return;
		}

		setUsers((items) => items.map((item) => item.id === user.id ? { ...item, status } : item));
	};

	const toggleUserAdmin = async (user: OeaUser) => {
		if (user.id === currentUser()?.id && user.is_admin) {
			setMessage("Non rimuovere il ruolo admin dall'utente corrente.");
			return;
		}

		const { error } = await supabase.from("oea_users").update({ is_admin: !user.is_admin }).eq("id", user.id);

		if (error) {
			setMessage("Errore nell'aggiornamento del ruolo admin.");
			return;
		}

		setUsers((items) => items.map((item) => item.id === user.id ? { ...item, is_admin: !user.is_admin } : item));
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

	const parseQuickValues = () =>
		quickInput()
			.split("/")
			.map((part) => part.trim())
			.map((part) => {
				if (!part) return null;
				const value = Number(part);
				return Number.isFinite(value) ? value : null;
			});

	const quickPlayer = createMemo(() => players().find((player) => player.user_id === quickPlayerId()) ?? null);

	const quickPreview = createMemo(() => {
		const values = parseQuickValues();

		return activeVoices().map((voice, index) => ({
			voice,
			score: values[index] ?? null,
		}));
	});

	const quickValuesCount = createMemo(() => parseQuickValues().length);

	const quickTotal = createMemo(() =>
		quickPreview()
			.filter((item) => item.score !== null && item.voice.counts_in_total !== false)
			.reduce((sum, item) => sum + Number(item.score), 0)
	);

	const openQuickInput = (player: GamePlayer) => {
		const existingValues = activeVoices().map((voice) => String(getScore(player.user_id, voice.id)));
		const lastFilledIndex = existingValues.reduce<number>(
			(lastIndex, value, index) => value === "" ? lastIndex : index,
			-1
		);

		setQuickPlayerId(player.user_id);
		setQuickInput(lastFilledIndex >= 0 ? existingValues.slice(0, lastFilledIndex + 1).join("/") : "");
	};

	const closeQuickInput = () => {
		setQuickPlayerId("");
		setQuickInput("");
	};

	const appendQuickKey = (key: string) => {
		setQuickInput((value) => `${value}${key}`);
	};

	const backspaceQuickInput = () => {
		setQuickInput((value) => value.slice(0, -1));
	};

	const applyQuickScores = async () => {
		const gameId = selectedGameId();
		const playerId = quickPlayerId();

		if (!gameId || !playerId) return;

		setQuickSaving(true);
		const rows = quickPreview().map((item) => ({
			game_id: gameId,
			user_id: playerId,
			voice_id: item.voice.id,
			score: item.score,
		}));

		const { error } = await supabase.from("oea_scores").upsert(rows, {
			onConflict: "game_id,user_id,voice_id",
		});

		setQuickSaving(false);

		if (error) {
			setMessage("Errore nel salvataggio rapido dei punteggi.");
			return;
		}

		setScores((current) => {
			const withoutPlayerActiveVoices = current.filter(
				(score) => score.user_id !== playerId || !activeVoices().some((voice) => voice.id === score.voice_id)
			);

			return [
				...withoutPlayerActiveVoices,
				...rows.map((row) => ({
					user_id: row.user_id,
					voice_id: row.voice_id,
					score: row.score,
				})),
			];
		});
		closeQuickInput();
	};

	const saveScore = async (userId: string, voiceId: string, value: string) => {
		const gameId = selectedGameId();
		const trimmed = value.trim();
		const score = trimmed === "" ? null : Number(trimmed);

		if (!gameId || (score !== null && !Number.isFinite(score))) return;

		setScores((current) => {
			const existing = current.find((item) => item.user_id === userId && item.voice_id === voiceId);
			if (existing) {
				return current.map((item) => item.user_id === userId && item.voice_id === voiceId ? { ...item, score } : item);
			}

			return [...current, { user_id: userId, voice_id: voiceId, score }];
		});

		const { error } = await supabase.from("oea_scores").upsert({
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

	const switchSection = (section: Section) => {
		setActiveSection(section);
		setDrawerOpen(false);

		if (section === "games") {
			backToGames();
		}
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

	return (
		<div class="h-screen bg-gray-50 text-gray-900">
			<div class="flex h-full">
				<Show when={isLandscape()}>
					<aside class="w-60 border-r border-gray-200 bg-white p-4">
						<div class="mb-6">
							<h1 class="text-xl font-bold">OEA</h1>
							<p class="truncate text-sm text-gray-500">{currentUser()?.name}</p>
						</div>
						<Nav />
						<button class="mt-6 w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50" onClick={logout}>
							Logout
						</button>
					</aside>
				</Show>

				<div class="flex min-w-0 flex-1 flex-col">
					<header class="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
						<div class="flex min-w-0 items-center gap-3">
							<Show when={!isLandscape()}>
								<button class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0551b5]" onClick={() => setDrawerOpen(true)} aria-label="Apri menu">
									<MenuIcon />
								</button>
							</Show>
							<div class="min-w-0">
								<h1 class="truncate text-lg font-bold">OEA</h1>
								<p class="truncate text-xs text-gray-500">
									{activeSection() === "games" ? isGameDetailPage() ? "Dettaglio partita" : "Partite" : activeSection() === "voices" ? "Voci" : "Utenti"}
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
						<main class="flex-1 overflow-y-auto p-4 pb-40">
							<Show when={activeSection() === "games"}>
								<GamesSection
									isLandscape={isLandscape}
									saving={saving}
									activeUsers={activeUsers}
									games={games}
									selectedGameId={selectedGameId}
									selectedGame={selectedGame}
									isDetailPage={isGameDetailPage}
									players={players}
									activeVoices={activeVoices}
									totals={totals}
									playedAt={playedAt}
									setPlayedAt={setPlayedAt}
									onRecord={onRecord}
									setOnRecord={setOnRecord}
									notes={notes}
									setNotes={setNotes}
									selectedUserIds={selectedUserIds}
									toggleUser={toggleUser}
									moveSelectedUser={moveSelectedUser}
									createGame={createGame}
									selectGame={openGameDetail}
									backToGames={backToGames}
									deleteGame={deleteGame}
									getScore={getScore}
									saveScore={saveScore}
									openQuickInput={openQuickInput}
									quickPlayer={quickPlayer}
									quickInput={quickInput}
									setQuickInput={setQuickInput}
									appendQuickKey={appendQuickKey}
									backspaceQuickInput={backspaceQuickInput}
									closeQuickInput={closeQuickInput}
									quickPreview={quickPreview}
									quickTotal={quickTotal}
									quickValuesCount={quickValuesCount}
									quickSaving={quickSaving}
									applyQuickScores={applyQuickScores}
								/>
							</Show>

							<Show when={activeSection() === "voices"}>
								<div class="mx-auto max-w-2xl">
									<VoicesSection
										voices={voices}
										newVoiceName={newVoiceName}
										setNewVoiceName={setNewVoiceName}
										editingVoiceId={editingVoiceId}
										setEditingVoiceId={setEditingVoiceId}
										editingVoiceName={editingVoiceName}
										setEditingVoiceName={setEditingVoiceName}
										createVoice={createVoice}
										moveVoice={moveVoice}
										toggleVoice={toggleVoice}
										toggleVoiceCountsInTotal={toggleVoiceCountsInTotal}
										startEditVoice={startEditVoice}
										saveVoiceName={saveVoiceName}
									/>
								</div>
							</Show>

							<Show when={activeSection() === "users" && currentUser()?.is_admin}>
								<UsersSection
									users={users}
									currentUser={currentUser}
									updateUserStatus={updateUserStatus}
									toggleUserAdmin={toggleUserAdmin}
									deleteAuthUser={deleteAuthUser}
								/>
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
							<h2 class="text-xl font-bold">OEA</h2>
							<p class="truncate text-sm text-gray-500">{currentUser()?.name}</p>
						</div>
						<button class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700" onClick={() => setDrawerOpen(false)} aria-label="Chiudi menu">
							<CloseIcon />
						</button>
					</div>
					<Nav />
				</aside>
			</Show>
		</div>
	);
}
