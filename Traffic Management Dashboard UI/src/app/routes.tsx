import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { RouteComparison } from "./components/RouteComparison";
import { Analytics } from "./components/Analytics";
import { LoginPage } from "./components/LoginPage";
import { PasswordRecoveryPage } from "./components/PasswordRecoveryPage";
import { SignUpPage } from "./components/SignUpPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: LandingPage },
      { path: "dashboard", Component: Dashboard },
      { path: "routes", Component: RouteComparison },
      { path: "analytics", Component: Analytics },
    ],
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/signup",
    Component: SignUpPage,
  },
  {
    path: "/password-recovery",
    Component: PasswordRecoveryPage,
  },
]);
