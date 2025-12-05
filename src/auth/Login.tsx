import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { supabase } from "../supabaseClient";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [message, setMessage] = createSignal("");

  async function handleLogin() {
    setMessage("");

    // 1) LOGIN
    const { data: loginData, error } = await supabase.auth.signInWithPassword({
      email: email(),
      password: password(),
    });

    if (error) {
      setMessage("❌ Email o password errati");
      return;
    }

    // 2) PRENDO USER LOGGATO
    const user = loginData.user;
    if (!user) {
      setMessage("❌ Errore: utente non trovato dopo login.");
      return;
    }

    // 3) PRENDO IL PROFILO PER SCOPRIRE IL RUOLO
    const { data: profile, error: profileErr } = await supabase
      .from("onshift_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      setMessage("❌ Errore caricamento profilo.");
      return;
    }

    // 4) REDIRECT BASATO SUL RUOLO
    if (profile.role === "ADMIN") {
      navigate("/admin");
    } else {
      navigate("/employee");
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-100">
      <div class="bg-white shadow-lg rounded-xl p-8 w-96">
        <h1 class="text-2xl font-semibold text-center mb-6">Accedi a OnShift</h1>

        <input
          type="email"
          placeholder="Email"
          class="w-full p-2 border rounded mb-3"
          onInput={(e) => setEmail(e.currentTarget.value)}
        />

        <input
          type="password"
          placeholder="Password"
          class="w-full p-2 border rounded mb-4"
          onInput={(e) => setPassword(e.currentTarget.value)}
        />

        <button
          class="w-full bg-blue-600 text-white p-2 rounded mb-3"
          onClick={handleLogin}
        >
          Login
        </button>

        <p class="text-center text-sm text-gray-600">
          Nuovo utente?{" "}
          <span
            class="text-blue-600 cursor-pointer"
            onClick={() => navigate("/register")}
          >
            Registrati
          </span>
        </p>

        <p class="text-center mt-3">{message()}</p>
      </div>
    </div>
  );
}
