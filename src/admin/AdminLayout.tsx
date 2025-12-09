import { JSX, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

interface AdminLayoutProps {
  userTab: JSX.Element;
  employeesTab: JSX.Element;
}

export default function AdminLayout(props: AdminLayoutProps) {
  const navigate = useNavigate();
  const [active, setActive] = createSignal("employees");

  function logout() {
    navigate("/");
  }

  const menuItem = (key: string, label: string) => (
    <div
      class={`cursor-pointer px-4 py-3 rounded-lg mb-2 font-semibold 
      ${active() === key ? "bg-[#0551b5] text-white" : "text-gray-700 hover:bg-gray-100"}`}
      onClick={() => setActive(key)}
    >
      {label}
    </div>
  );

  return (
    <div class="flex min-h-screen bg-gray-50">

      {/* SIDEBAR */}
      <aside class="w-56 bg-white border-r border-gray-200 p-6 shadow-sm">
        <h1 class="text-2xl font-bold mb-8 text-[#0551b5]">Admin</h1>

        {menuItem("employees", "Dipendenti")}
        {menuItem("user", "Dati Utente")}

        <div
          class="cursor-pointer px-4 py-3 rounded-lg mt-6 text-red-600 font-semibold hover:bg-red-50"
          onClick={logout}
        >
          Logout
        </div>
      </aside>

      {/* CONTENUTO */}
      <main class="flex-1 p-10">
        {active() === "employees" ? props.employeesTab : props.userTab}
      </main>

    </div>
  );
}
