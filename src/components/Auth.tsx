import { createSignal } from 'solid-js'
import { supabase } from '../lib/supabaseClient'

const Auth = ({ setSession }: { setSession: (session: any) => void }) => {
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)

  const signIn = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email(),
      password: password(),
    })

    if (error) {
      setError(error.message)
    } else {
      setSession(data.session)
    }

    setLoading(false)
  }

  return (
    <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div class="w-full max-w-sm space-y-6">
        <h1 class="text-2xl font-bold text-center">Login</h1>

        <input
          class="w-full px-4 py-2 bg-gray-800 rounded"
          type="email"
          placeholder="Email"
          value={email()}
          onInput={(e) => setEmail(e.currentTarget.value)}
        />

        <input
          class="w-full px-4 py-2 bg-gray-800 rounded"
          type="password"
          placeholder="Password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && signIn()}
        />

        <button
          class="w-full bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-semibold"
          onClick={signIn}
          disabled={loading()}
        >
          {loading() ? 'Accesso...' : 'Accedi'}
        </button>

        {error() && <div class="text-red-400 text-sm">{error()}</div>}
      </div>
    </div>
  )
}

export default Auth
