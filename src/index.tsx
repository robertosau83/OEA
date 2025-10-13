import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import './index.css'
import { supabase } from './lib/supabaseClient'
import Auth from './components/Auth'
import App from './App'
import type { Session } from '@supabase/supabase-js'

const root = document.getElementById('root')

type User = {
  id: string
  user_id: string
  name: string | null
  license_exp_date: string | null
}

const today = () => new Date().toISOString().split('T')[0]

const Main = () => {
  const [session, setSession] = createSignal<Session | null>(null)
  const [user, setUser] = createSignal<User | null>(null)
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(true)

  const fetchUser = async (userId: string) => {
    const { data, error } = await supabase
      .from('Ahead_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) {
      setErrorMsg('Utente non trovato o errore Supabase')
      return
    }

    if (data.license_exp_date && today() > data.license_exp_date) {
      setErrorMsg('Licenza scaduta')
      return
    }

    setUser(data)
  }

  // Caricamento iniziale della sessione
  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      setSession(data.session)
      await fetchUser(data.session.user.id)
    }
    setIsLoading(false)
  })

  // Listener per login/logout
  supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession)
    if (newSession?.user) {
      setIsLoading(true)
      fetchUser(newSession.user.id).then(() => setIsLoading(false))
    } else {
      setUser(null)
      setIsLoading(false)
    }
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setErrorMsg(null)
    setIsLoading(false)
  }

  return (
    <div>
      {isLoading() ? (
        <div class="h-screen flex items-center justify-center text-lg font-semibold">
          Caricamento...
        </div>
      ) : session() && user() ? (
        <App user={user()!} onLogout={handleLogout} />
      ) : (
        <Auth setSession={setSession} />
      )}
    </div>
  )
}

render(() => <Main />, root!)
