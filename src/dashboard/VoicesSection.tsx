import { For, Show } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { ArrowDownIcon, ArrowUpIcon, EditIcon } from "./icons";
import type { Voice } from "./types";

interface VoicesSectionProps {
	voices: Accessor<Voice[]>;
	newVoiceName: Accessor<string>;
	setNewVoiceName: Setter<string>;
	editingVoiceId: Accessor<string>;
	setEditingVoiceId: Setter<string>;
	editingVoiceName: Accessor<string>;
	setEditingVoiceName: Setter<string>;
	createVoice: () => void;
	moveVoice: (voiceId: string, direction: -1 | 1) => void;
	toggleVoice: (voice: Voice) => void;
	toggleVoiceCountsInTotal: (voice: Voice) => void;
	startEditVoice: (voice: Voice) => void;
	saveVoiceName: (voice: Voice) => void;
}

export default function VoicesSection(props: VoicesSectionProps) {
	return (
		<div class="space-y-4">
			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-4 text-base font-semibold text-gray-900">Nuova voce</h2>

				<div class="flex gap-2">
					<input
						class="h-11 min-w-0 flex-1 rounded border border-gray-300 px-3"
						placeholder="Nome voce"
						value={props.newVoiceName()}
						onInput={(event) => props.setNewVoiceName(event.currentTarget.value)}
						onKeyDown={(event) => event.key === "Enter" && props.createVoice()}
					/>
					<button class="h-11 rounded-full bg-[#0551b5] px-4 text-sm font-semibold text-white" onClick={props.createVoice}>
						Aggiungi
					</button>
				</div>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="mb-4 text-base font-semibold text-gray-900">Voci</h2>

				<div class="space-y-2">
					<For each={props.voices().slice().sort((a, b) => a.sort_order - b.sort_order)}>
						{(voice, index) => (
							<div class={`rounded border border-gray-200 p-3 ${voice.is_active ? "" : "opacity-45"}`}>
								<Show
									when={props.editingVoiceId() === voice.id}
									fallback={
										<div class="space-y-3">
											<div class="flex items-center gap-3">
												<div class="flex overflow-hidden rounded-full border border-gray-300">
													<button
														class="flex h-8 w-8 items-center justify-center text-gray-700 disabled:opacity-30"
														title="Sposta su"
														aria-label="Sposta voce su"
														disabled={index() === 0}
														onClick={() => props.moveVoice(voice.id, -1)}
													>
														<ArrowUpIcon />
													</button>
													<button
														class="flex h-8 w-8 items-center justify-center border-l border-gray-300 text-gray-700 disabled:opacity-30"
														title="Sposta giu"
														aria-label="Sposta voce giu"
														disabled={index() === props.voices().length - 1}
														onClick={() => props.moveVoice(voice.id, 1)}
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
														<input type="checkbox" class="h-4 w-4" checked={voice.counts_in_total} onChange={() => props.toggleVoiceCountsInTotal(voice)} />
														Totale
													</label>
													<label class="flex items-center gap-2 text-xs font-semibold text-gray-700">
														<input type="checkbox" class="h-4 w-4" checked={voice.is_active} onChange={() => props.toggleVoice(voice)} />
														Attiva
													</label>
												</div>
												<button
													class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700"
													title="Modifica voce"
													aria-label="Modifica voce"
													onClick={() => props.startEditVoice(voice)}
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
											value={props.editingVoiceName()}
											onInput={(event) => props.setEditingVoiceName(event.currentTarget.value)}
										/>
										<button class="rounded-full bg-[#0551b5] px-3 text-xs font-semibold text-white" onClick={() => props.saveVoiceName(voice)}>
											Salva
										</button>
										<button class="rounded-full border border-gray-300 px-3 text-xs font-semibold text-gray-700" onClick={() => props.setEditingVoiceId("")}>
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
}
