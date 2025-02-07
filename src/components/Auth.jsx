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
        class="border rounded px-2 py-1 mt-2"
      />
      <button onClick={signIn} class="bg-orange-400 text-white px-4 py-2 mt-4">
        Sign In
      </button>
      <h1>ffffff</h1>
      {error() && <p class="text-red-500 mt-2">{error()}</p>}
    </div>
  );
};

export default Auth;
