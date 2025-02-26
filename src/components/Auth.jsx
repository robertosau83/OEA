import { createSignal } from 'solid-js';
import { supabase } from '../lib/supabaseClient.js';

const Auth = ({ setSession }) => {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email(),
      password: password(),
    });
    if (error) {
      setError(error.message);
    } else {
      setSession(data.session); // Aggiorna la sessione autenticata
    }
  };

  // 🔹 Funzione per il login con Google
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Reindirizza alla tua app dopo il login
      },
    });
    if (error) {
      setError(error.message);
    }
  };

  return (
    <div class="flex w-full h-[100vh] flex-col items-center justify-center">
      <img
        src="/ElSanto Business.jpg"
        alt="ElSanto Business"
        class="w-[70%] max-w-[300px] h-auto mb-12"
      />
      <input
        type="email"
        placeholder="Email"
        onInput={(e) => setEmail(e.currentTarget.value)}
        class="border rounded px-2 py-1"
      />
      <input
        type="password"
        placeholder="Password"
        onInput={(e) => setPassword(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && signIn()}
        class="border rounded px-2 py-1 mt-2"
      />
      <button onClick={signIn} class="bg-orange-400 text-white px-4 py-2 mt-4">
        Sign In
      </button>

      {/* 🔹 Bottone per login con Google */}
      {/* <button
        onClick={signInWithGoogle}
        class="bg-red-500 text-white px-4 py-2 mt-4 flex items-center gap-2"
      >
        <img src="/google-icon.svg" alt="Google" class="w-5 h-5" />
        Sign in with Google
      </button> */}

      {error() && <p class="text-red-500 mt-2">{error()}</p>}
    </div>
  );
};

export default Auth;
