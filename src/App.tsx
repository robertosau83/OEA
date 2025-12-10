import { Route } from "@solidjs/router";

import Login from "./auth/Login";
import Register from "./auth/Register";
import AdminIndex from "./admin/AdminIndex";
import EmployeeIndex from "./employee/EmployeeIndex";

export default function App() {
  return (
    <>
      <Route path="/" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin" component={AdminIndex} />
      <Route path="/employee" component={EmployeeIndex} />
    </>
  );
}
