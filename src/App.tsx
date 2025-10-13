import type { Component } from 'solid-js'

type User = {
  id: string
  user_id: string
  name: string | null
  license_exp_date: string | null
}

type Props = {
  user: User
  onLogout: () => void
}

const App: Component<Props> = ({ user, onLogout }) => {
  return (
    <div class="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div class="text-center space-y-4">
        <h1 class="text-3xl font-bold">Benvenuto {user.name ?? ''}</h1>
        <p class="text-gray-400 text-sm">Licenza valida fino al {user.license_exp_date}</p>
        <button
          class="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-semibold"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default App
