export interface OeaUser {
	id: string;
	name: string;
	email: string;
	status: string;
	is_admin: boolean;
}

export interface Voice {
	id: string;
	code: string;
	name: string;
	sort_order: number;
	is_active: boolean;
	counts_in_total: boolean;
}

export interface Game {
	id: string;
	played_at: string;
	on_record: boolean;
	notes: string | null;
	created_by: string;
	created_at: string;
	creator_name: string;
	player_names: string[];
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
