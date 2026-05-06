import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { RouteComparison } from "./components/RouteComparison";
import { Analytics } from "./components/Analytics";
import { LoginPage } from "./components/LoginPage";
import { PasswordRecoveryPage } from "./components/PasswordRecoveryPage";
import { ProfilePage } from "./components/ProfilePage";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdmin } from "./components/RequireAdmin";
import { SignUpPage } from "./components/SignUpPage";
import { SpeedMeterPrototypePage } from "./components/SpeedMeterPrototypePage";
import { AdminPage } from "./components/AdminPage";
import { NotFoundPage } from "./components/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: LandingPage },
      { path: "speed-meter", Component: SpeedMeterPrototypePage },
      {
        Component: RequireAuth,
        children: [
          { path: "dashboard", Component: Dashboard },
          { path: "routes", Component: RouteComparison },
          { path: "analytics", Component: Analytics },
          { path: "profile", Component: ProfilePage },
          {
            Component: RequireAdmin,
            children: [
              { path: "admin", Component: AdminPage },
            ],
          },
        ],
      },
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
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
