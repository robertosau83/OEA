export interface OeaUser {
	id: string;
	name: string;
	email: string;
	status: string;
	is_admin: boolean;
}

export interface Voice {
	id: string;
	name: string;
	sort_order: number;
	is_active: boolean;
	counts_in_total: boolean;
	voice_type: VoiceType;
}

export type VoiceType = "PRIMARY" | "SECONDARY";

export interface VoiceFormValues {
	name: string;
	voice_type: VoiceType;
	counts_in_total: boolean;
}

export interface GameListPlayer {
	user_id: string;
	name: string;
	is_winner: boolean;
}

export interface Game {
	id: string;
	played_at: string;
	notes: string | null;
	created_by: string;
	created_at: string;
	creator_name: string;
	player_names: string[];
	list_players: GameListPlayer[];
}

export interface GamePlayer {
	user_id: string;
	player_order: number;
	name: string;
	email: string;
}

export interface Score {
	user_id: string;
	voice_id: string;
	score: number | null;
}

export interface QuickPreviewItem {
	voice: Voice;
	score: number | null;
}

export type Section = "games" | "statistics" | "voices" | "users";
export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export interface QuickScoreRow extends Score {
	game_id: string;
}

export interface QuickScoreSaveOptions {
	timeoutMs?: number;
	retryDelayMs?: number;
	pendingWrites?: Promise<unknown>;
}

export interface StatisticsGame {
	id: string;
	played_at: string;
}

export interface StatisticsGamePlayer {
	game_id: string;
	user_id: string;
}

export interface StatisticsScore extends Score {
	game_id: string;
}

export interface StatisticsData {
	games: StatisticsGame[];
	gamePlayers: StatisticsGamePlayer[];
	scores: StatisticsScore[];
}

export type StatisticsPlayer = Pick<OeaUser, "id" | "name">;

export interface StatisticsInput extends StatisticsData {
	voices: Voice[];
	selectedPlayers: StatisticsPlayer[];
}

export interface StatisticsTotal {
	userId: string;
	playerName: string;
	total: number;
}

export interface StatisticsGameResult {
	game: StatisticsGame;
	totals: StatisticsTotal[];
	bestTotal: number;
	pointWinnerIds: string[];
}

export interface StatisticsRecord extends StatisticsTotal {
	game: StatisticsGame;
}

export interface StatisticsResult {
	comparedGames: StatisticsGame[];
	gameResults: StatisticsGameResult[];
	excludedIncompleteGames: number;
	victoryStats: {
		gamesWithPoints: number;
		gamesWithoutPoints: number;
		pointsAssigned: number;
		rows: { player: StatisticsPlayer; wins: number }[];
	};
	totalPointsByPlayer: { player: StatisticsPlayer; total: number }[];
	voiceRankings: { voice: Voice; rows: { player: StatisticsPlayer; total: number; rank: number }[] }[];
	records: { highest: StatisticsRecord[]; lowest: StatisticsRecord[] };
}
