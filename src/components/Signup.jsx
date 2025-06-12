import { createSignal } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Signup = () => {
	const [nickname, setNickname] = createSignal('');
	const [companyName, setCompanyName] = createSignal('');
	const [email, setEmail] = createSignal('');
	const [password, setPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [success, setSuccess] = createSignal('');

	const handleSignup = async () => {
		setError('');
		setSuccess('');

		const emailConsentita = "robertosau83@gmail.com";
		if (email().toLowerCase() !== emailConsentita.toLowerCase()) {
			setError("Questa email non è autorizzata per la registrazione.");
			return;
		}

		const { data, error } = await supabase.auth.signUp({
			email: email(),
			password: password(),
		});

		if (error || !data.user) {
			setError(error?.message || "Errore durante la registrazione.");
			return;
		}

		const userId = data.user.id;

		// Dopo inserimento in companies:
		const { data: companyInsert, error: insertError } = await supabase
			.from('companies')
			.insert({ name: companyName() })
			.select()
			.single();

		if (insertError) {
			setError("Errore nella creazione della compagnia: " + insertError.message);
			return;
		}

		// Ora crea relazione nella tabella users_companies
		const { error: linkError } = await supabase
			.from('users_companies')
			.insert({
				user_id: userId,
				company_id: companyInsert.id,
				name: nickname()
			});

		if (linkError) {
			setError("Errore nella creazione del collegamento utente-compagnia: " + linkError.message);
			return;
		}

		setSuccess("Registrazione completata!");
	};

	return (
		<div class="flex flex-col items-center justify-center h-screen p-4 gap-4">

			{!success() && (
				<>
					<h2 class="text-xl font-semibold">Registrati</h2>

					<input type="text" placeholder="Nickname" onInput={(e) => setNickname(e.currentTarget.value)} class="border px-2 py-1 rounded w-full max-w-xs" />
					<input type="text" placeholder="Nome compagnia" onInput={(e) => setCompanyName(e.currentTarget.value)} class="border px-2 py-1 rounded w-full max-w-xs" />
					<input type="email" placeholder="Email" onInput={(e) => setEmail(e.currentTarget.value)} class="border px-2 py-1 rounded w-full max-w-xs" />
					<input type="password" placeholder="Password" onInput={(e) => setPassword(e.currentTarget.value)} class="border px-2 py-1 rounded w-full max-w-xs" />

					<button onClick={handleSignup} class="bg-blue-800 text-white px-4 py-2 rounded">
						Conferma
					</button>
				</>
			)}

			{error() && <p class="text-red-500">{error()}</p>}
			{success() && <p class="text-green-600">{success()}</p>}
			{success() && (
				<button
					onClick={() => window.location.href = '/'}
					class="mt-2 bg-green-700 text-white px-4 py-2 rounded"
				>
					Vai alla tua Home
				</button>
			)}
		</div>
	);

};

export default Signup;
