/* @refresh reload */
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';

import './index.css';
import { supabase } from './lib/supabaseClient.js';
import Auth from './components/Auth.jsx';
import App from './App.jsx';

const root = document.getElementById('root');

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/serviceWorker.js")
		.then(() => {
			console.log("Service Worker registrato con successo.");
		})
		.catch((error) => {
			console.error("Errore nella registrazione del Service Worker:", error);
		});
}

const Main = () => {
	const [session, setSession] = createSignal(null);
	const [companyId, setCompanyId] = createSignal(null);
	const [companyName, setCompanyName] = createSignal(null);
	const [nickName, setNickname] = createSignal(null);
	const [bancaImportPDF, setBancaImportPDF] = createSignal(null);
	const [isLoading, setIsLoading] = createSignal(true); // 🔹 Stato per il caricamento

	// Funzione per recuperare il company_id
	const fetchCompanyId = async (userId) => {
		if (!userId) {
			setIsLoading(false); // Se non c'è un utente, smetti di caricare
			return;
		}

		const { data: companyData, error } = await supabase
			.from("users_companies")
			.select("*")
			.eq("user_id", userId)
			.single();

		if (!error) {
			setCompanyId(companyData.company_id);
			setNickname(companyData.name);
		} else {
			console.error("Errore nel recupero del company_id:", error);
		}

		const { data: companiesData, companiesError } = await supabase
			.from("companies")
			.select("*")
			.eq("id", companyId())
			.single();

		if (!companiesError) {
			setCompanyName(companiesData.name)
			setBancaImportPDF(companiesData.banca_import_pdf)
		} else {
			console.error("Errore nel recupero del company_id:", companiesError);
		}

		setIsLoading(false); // 🔹 Ora possiamo renderizzare l'app
	};

	// Recupera la sessione all'avvio
	supabase.auth.getSession().then(({ data }) => {
		if (data.session) {
			setSession(data.session);
			fetchCompanyId(data.session.user.id); // 🔹 Recuperiamo il company_id PRIMA di renderizzare App
			//console.log("index.jsx: Recupera la sessione all'avvio");
		} else {
			setIsLoading(false); // Se non c'è una sessione, niente da recuperare
			//console.log("index.jsx: NO Recupera la sessione all'avvio");
		}
	});

	// Gestisce i cambi di autenticazione
	supabase.auth.onAuthStateChange(async (_event, newSession) => {
		//console.log("index.jsx: onAuthStateChange triggerato", _event, newSession);

		// Evita di eseguire il codice se la sessione non è effettivamente cambiata
		if (newSession?.user?.id === session()?.user?.id) {
			//console.log("index.jsx: La sessione è identica, non aggiorno nulla");
			return;
		}

		setSession(newSession);

		if (newSession?.user) {
			setIsLoading(true); // Blocca il rendering finché company_id non è pronto
			fetchCompanyId(newSession.user.id); // ❌ Rimosso `await`
			//console.log("index.jsx: Sessione cambiata, recupero company_id");
		} else {
			setCompanyId(null);
			setCompanyName(null);
			setNickname(null);
			setBancaImportPDF(null);
			setIsLoading(false);
			//console.log("index.jsx: Nessun utente, resetto stato");
		}
	});


	const handleLogout = async () => {
		const { error } = await supabase.auth.signOut();
		if (error) {
			console.error("Errore durante il logout:", error.message);
		}
		setSession(null);
		setCompanyId(null);
		setCompanyName(null);
		setNickname(null);
		setBancaImportPDF(null);
		setIsLoading(false);
	};

	return (
		<div>
			{isLoading() ? (
				<div class="flex h-screen items-center justify-center">
					<p class="text-lg font-semibold">Caricamento...</p>
				</div>
			) : session() ? (
				<App companyId={companyId()} companyName={companyName()} nickName={nickName()} bancaImportPDF={bancaImportPDF()} onLogout={handleLogout} />
			) : (
				<Auth setSession={setSession} />
			)}
		</div>
	);
};

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
	throw new Error(
		'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
	);
}

render(() => <Main />, root);
