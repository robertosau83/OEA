import { For, Show, createMemo, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, EditIcon, TrashIcon } from "./icons";
import type { Voice, VoiceFormValues, VoiceType } from "./types";

interface VoicesSectionProps {
	voices: Accessor<Voice[]>;
	createVoice: (values: VoiceFormValues) => Promise<boolean>;
	updateVoice: (voice: Voice, values: VoiceFormValues) => Promise<boolean>;
	deleteVoice: (voice: Voice) => Promise<boolean>;
	moveVoice: (voiceId: string, direction: -1 | 1) => void;
}

export default function VoicesSection(props: VoicesSectionProps) {
	const [modalOpen, setModalOpen] = createSignal(false);
	const [editingVoice, setEditingVoice] = createSignal<Voice | null>(null);
	const [name, setName] = createSignal("");
	const [voiceType, setVoiceType] = createSignal<VoiceType>("PRIMARY");
	const [countsInTotal, setCountsInTotal] = createSignal(true);
	const [saving, setSaving] = createSignal(false);

	const activeVoices = createMemo(() =>
		props.voices()
			.filter((voice) => voice.is_active)
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order)
	);

	const closeModal = () => {
		if (saving()) return;
		setModalOpen(false);
		setEditingVoice(null);
	};

	const openCreateModal = () => {
		setEditingVoice(null);
		setName("");
		setVoiceType("PRIMARY");
		setCountsInTotal(true);
		setModalOpen(true);
	};

	const openEditModal = (voice: Voice) => {
		setEditingVoice(voice);
		setName(voice.name);
		setVoiceType(voice.voice_type);
		setCountsInTotal(voice.counts_in_total);
		setModalOpen(true);
	};

	const saveVoice = async () => {
		const values: VoiceFormValues = {
			name: name().trim(),
			voice_type: countsInTotal() ? voiceType() : "PRIMARY",
			counts_in_total: countsInTotal(),
		};
		if (!values.name || saving()) return;

		setSaving(true);
		const voice = editingVoice();
		const saved = voice
			? await props.updateVoice(voice, values)
			: await props.createVoice(values);
		setSaving(false);

		if (saved) closeModal();
	};

	const deleteVoice = async (voice: Voice) => {
		if (!window.confirm(`Eliminare la voce "${voice.name}"? Le partite storiche manterranno i punteggi collegati.`)) return;
		await props.deleteVoice(voice);
	};

	return (
		<div class="space-y-4">
			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<div class="mb-4">
					<h2 class="text-base font-semibold text-gray-900">Voci</h2>
					<p class="mt-1 text-xs text-gray-500">Gestisci le voci disponibili nelle partite.</p>
				</div>

				<div class="space-y-2">
					<For each={activeVoices()} fallback={<p class="rounded bg-gray-50 px-3 py-4 text-sm text-gray-500">Nessuna voce attiva.</p>}>
						{(voice, index) => (
							<div class="rounded-lg border border-gray-200 p-3">
								<div class="flex items-center gap-3">
									<div class="flex shrink-0 overflow-hidden rounded-full border border-gray-300">
										<button
											class="flex h-8 w-8 items-center justify-center text-gray-700 disabled:opacity-30"
											title="Sposta su"
											aria-label={`Sposta su ${voice.name}`}
											disabled={index() === 0}
											onClick={() => props.moveVoice(voice.id, -1)}
										>
											<ArrowUpIcon />
										</button>
										<button
											class="flex h-8 w-8 items-center justify-center border-l border-gray-300 text-gray-700 disabled:opacity-30"
											title="Sposta giù"
											aria-label={`Sposta giù ${voice.name}`}
											disabled={index() === activeVoices().length - 1}
											onClick={() => props.moveVoice(voice.id, 1)}
										>
											<ArrowDownIcon />
										</button>
									</div>

									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-semibold text-gray-900">{voice.name}</p>
										<div class="mt-1 flex flex-wrap gap-1.5">
											<Show when={voice.counts_in_total}>
												<span class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
													voice.voice_type === "PRIMARY"
														? "bg-blue-50 text-[#0551b5]"
														: "bg-violet-50 text-violet-700"
												}`}>
													{voice.voice_type === "PRIMARY" ? "Primaria" : "Secondaria"}
												</span>
											</Show>
											<span class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
												voice.counts_in_total
													? "bg-emerald-50 text-emerald-700"
													: "bg-gray-100 text-gray-500"
											}`}>
												{voice.counts_in_total ? "Nel totale" : "Fuori totale"}
											</span>
										</div>
									</div>

									<div class="flex shrink-0 items-center gap-2">
										<button
											class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700"
											title="Modifica voce"
											aria-label={`Modifica ${voice.name}`}
											onClick={() => openEditModal(voice)}
										>
											<EditIcon />
										</button>
										<button
											class="flex h-9 items-center gap-1.5 rounded-full border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
											title="Elimina voce"
											aria-label={`Elimina ${voice.name}`}
											onClick={() => deleteVoice(voice)}
										>
											<TrashIcon />
											<span class="hidden sm:inline">Elimina</span>
										</button>
									</div>
								</div>
							</div>
						)}
					</For>
				</div>
			</section>

			<button
				class="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#0551b5] text-3xl font-light leading-none text-white shadow-lg active:bg-blue-800"
				aria-label="Crea nuova voce"
				title="Crea nuova voce"
				onClick={openCreateModal}
			>
				<img src="/icons/plus-white.svg" alt="" aria-hidden="true" class="h-7 w-7" />
			</button>

			<Show when={modalOpen()}>
				<div class="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center">
					<section class="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
						<div class="mb-5 flex items-center justify-between gap-3">
							<h2 class="text-lg font-bold text-gray-900">
								{editingVoice() ? "Modifica voce" : "Nuova voce"}
							</h2>
							<button
								class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700"
								aria-label="Chiudi"
								onClick={closeModal}
							>
								<CloseIcon />
							</button>
						</div>

						<label class="mb-4 block">
							<span class="mb-1 block text-sm font-medium text-gray-700">Nome</span>
							<input
								class="h-11 w-full rounded border border-gray-300 px-3"
								value={name()}
								autofocus
								onInput={(event) => setName(event.currentTarget.value)}
								onKeyDown={(event) => event.key === "Enter" && void saveVoice()}
							/>
						</label>

						<label class="mb-4 flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-3">
							<span>
								<span class="block text-sm font-medium text-gray-900">Includi nel totale</span>
								<span class="block text-xs text-gray-500">Il punteggio entra nel risultato della partita.</span>
							</span>
							<input
								type="checkbox"
								class="h-5 w-5"
								checked={countsInTotal()}
								onChange={(event) => {
									const checked = event.currentTarget.checked;
									setCountsInTotal(checked);
									if (!checked) setVoiceType("PRIMARY");
								}}
							/>
						</label>

						<Show when={countsInTotal()}>
							<label class="mb-5 block">
								<span class="mb-1 block text-sm font-medium text-gray-700">Tipo</span>
								<select
									class="h-11 w-full rounded border border-gray-300 bg-white px-3"
									value={voiceType()}
									onChange={(event) => setVoiceType(event.currentTarget.value as VoiceType)}
								>
									<option value="PRIMARY">Primaria</option>
									<option value="SECONDARY">Secondaria</option>
								</select>
							</label>
						</Show>

						<div class="flex gap-2">
							<button
								class="h-11 flex-1 rounded-full border border-gray-300 font-semibold text-gray-700"
								disabled={saving()}
								onClick={closeModal}
							>
								Annulla
							</button>
							<button
								class="h-11 flex-1 rounded-full bg-[#0551b5] font-semibold text-white disabled:opacity-60"
								disabled={saving() || !name().trim()}
								onClick={() => void saveVoice()}
							>
								{saving() ? "Salvataggio..." : "Salva"}
							</button>
						</div>
					</section>
				</div>
			</Show>
		</div>
	);
}
