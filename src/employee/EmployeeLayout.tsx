// src/employee/EmployeeLayout.tsx
import { JSX, createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useOrientation } from "../context/OrientationContext";

interface EmployeeLayoutProps {
  userTab: JSX.Element;
  userName: string;
  companyName: string;
}

export default function EmployeeLayout(props: EmployeeLayoutProps) {
  const navigate = useNavigate();
  const { isLandscape } = useOrientation();

  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  // NEW → stato voce attiva
  const [active, setActive] = createSignal("account");

  function logout() {
    navigate("/");
  }

  const menuItem = (key: string, label: string) => (
    <div
      class={`cursor-pointer px-4 py-3 rounded-lg mb-2 font-semibold transition
      ${
        active() === key
          ? "bg-[#0551b5] text-white"
          : "text-gray-700 hover:bg-gray-100"
      }`}
      onClick={() => {
        setActive(key);
        setSidebarOpen(false); // chiude su mobile
      }}
    >
      {label}
    </div>
  );

  return (
    <div
      class={
        isLandscape()
          ? "flex h-screen bg-gray-50"
          : "flex flex-col h-screen bg-gray-50 relative"
      }
    >
      {/* ----------------------------- */}
      {/* PORTRAIT TOP BAR */}
      {/* ----------------------------- */}
      {!isLandscape() && (
        <header class="w-full bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shadow-sm">
          <button
            class="p-2 rounded-full bg-blue-50"
            onClick={() => setSidebarOpen(true)}
          >
            <img src="/menu-blue.svg" class="w-6 h-6" />
          </button>
        </header>
      )}

      {/* ----------------------------- */}
      {/* SIDEBAR LANDSCAPE */}
      {/* ----------------------------- */}
      {isLandscape() && (
        <aside class="w-56 bg-white border-r border-gray-200 shadow-sm flex flex-col">
          <div class="py-2 px-6 border-b mb-4">
            <div class="text-xl font-bold text-[#0551b5]">
              {props.userName}
            </div>
            <div class="text-xl font-semibold text-[#0551b5] opacity-50">
              {props.companyName}
            </div>
          </div>

          <div class="px-2">
            {menuItem("account", "Account")}
          </div>

          <div
            class="cursor-pointer px-4 py-3 rounded-lg text-red-600 font-semibold hover:bg-red-50 mt-auto mb-6"
            onClick={logout}
          >
            Logout
          </div>
        </aside>
      )}

      {/* ----------------------------- */}
      {/* SIDEBAR MOBILE */}
      {/* ----------------------------- */}
      {!isLandscape() && (
        <>
          <Show when={sidebarOpen()}>
            <div
              class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity z-40"
              onClick={() => setSidebarOpen(false)}
            ></div>
          </Show>

          <div
            class={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform
            ${sidebarOpen() ? "translate-x-0" : "-translate-x-full"}`}
          >
            <div class="py-2 px-6 border-b">
              <div class="text-xl font-bold text-[#0551b5]">
                {props.userName}
              </div>
              <div class="text-xl font-semibold text-[#0551b5] opacity-50">
                {props.companyName}
              </div>
            </div>

            <div class="py-4 px-2">
              {menuItem("account", "Account")}
            </div>

            <div class="absolute bottom-4 left-0 right-0 px-4">
              <button
                class="w-full text-left px-4 py-3 rounded-lg text-red-600 font-semibold hover:bg-red-50"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}

      {/* ----------------------------- */}
      {/* CONTENUTO */}
      {/* ----------------------------- */}
      <main
        class={
          isLandscape()
            ? "flex-1 p-10 overflow-y-auto"
            : "flex-1 p-4 overflow-y-auto"
        }
      >
        {props.userTab}
      </main>
    </div>
  );
}
