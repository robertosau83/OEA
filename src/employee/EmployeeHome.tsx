import { createSignal, Show } from "solid-js";
import { supabase } from "../supabaseClient";
import { useNavigate } from "@solidjs/router";

interface EmployeeHomeProps {
  loading: boolean;
  userName: string;
  userEmail: string;
  role: string;
  companyName: string;
  companyId: string;
  status: string;
  inviteCode: string;
}

export default function EmployeeHome(props: EmployeeHomeProps) {

  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);

  const handleDeleteAccount = async () => {
    const { error } = await supabase.rpc("employee_delete_self");

    if (error) {
      alert("Errore nella cancellazione dell'account: " + error.message);
      return;
    }

    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <>
      <Show when={!props.loading} fallback={<div class="text-xl text-gray-600">Caricamento...</div>}>

        <div class="space-y-8 max-w-2xl">

          {/* TITLE */}
          <h1 class="font-bold text-2xl ml-2 tracking-tight text-gray-800">
            Account
          </h1>

          {/* USER CARD */}
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Profilo Personale</h2>

            <div class="space-y-4 text-gray-700">

              <div>
                <span class="font-medium text-gray-900">Nome</span>
                <p>{props.userName}</p>
              </div>

              <div>
                <span class="font-medium text-gray-900">Email</span>
                <p>{props.userEmail}</p>
              </div>

              <div>
                <span class="font-medium text-gray-900">Ruolo</span>
                <p class="capitalize">{props.role === "EMPLOYEE" ? "Dipendente" : ""}</p>
              </div>

            </div>
          </div>

          {/* COMPANY CARD */}
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Azienda</h2>

            <div class="space-y-4 text-gray-700">

              <div>
                <span class="font-medium text-gray-900">Nome azienda</span>
                <p>{props.companyName}</p>
              </div>

              {/* BADGE STATO */}
              <div>
                <span class="font-medium text-gray-900">Stato account</span>

                {props.status === "PENDING" ? (
                  <p class="mt-2">
                    <span class="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-semibold text-sm">
                      Sospeso
                    </span>
                  </p>
                ) : (
                  <p class="mt-2">
                    <span class="px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                      Attivo
                    </span>
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* DELETE ACCOUNT */}
          <div class="pt-6">
            <button
              class="px-5 py-2 bg-white text-red-600 border-2 border-red-600 rounded-full shadow-sm hover:bg-red-100 transition-colors"
              onClick={() => setShowDeleteModal(true)}
            >
              Cancella Account
            </button>
          </div>

        </div>

      </Show>

      {/* ---------------------- */}
      {/* MODAL DELETE ACCOUNT */}
      {/* ---------------------- */}
      <Show when={showDeleteModal()}>
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div class="bg-white p-6 rounded-xl shadow-xl max-w-[90%] text-center border border-gray-200 space-y-4">

            <h2 class="text-2xl font-bold text-red-700">Eliminazione Account</h2>
            <p class="text-gray-700">
              Questa operazione è <strong>irreversibile</strong>.<br />
              Il tuo account verrà eliminato e non sarà più visibile al datore di lavoro.
            </p>

            <div class="flex justify-center space-x-3 pt-2">
              <button
                class="px-4 py-1.5 border rounded-md text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setShowDeleteModal(false)}
              >
                Annulla
              </button>

              <button
                class="px-4 py-1.5 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 transition-colors"
                onClick={handleDeleteAccount}
              >
                Elimina
              </button>
            </div>

          </div>
        </div>
      </Show>
    </>
  );
}
