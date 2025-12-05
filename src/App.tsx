import { Route } from "@solidjs/router";
import LoginPage from "./auth/Login";
import RegisterPage from "./auth/Register";
import AdminHome from "./admin/AdminHome";
import EmployeeHome from "./employee/EmployeeHome";

export default function App() {
  return (
    <>
      <Route path="/" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* Home protette */}
      <Route path="/admin" component={AdminHome} />
      <Route path="/employee" component={EmployeeHome} />
    </>
  );
}
