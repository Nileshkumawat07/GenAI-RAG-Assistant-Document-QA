import React, { useEffect, useState } from "react";

import HomePage from "./features/auth/HomePage";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import { loginUser, signupUser } from "./features/auth/authApi";
import {
  clearCurrentUser,
  getCurrentUser,
  setCurrentUser,
} from "./features/auth/authStorage";
import WorkspacePage from "./features/workspace/WorkspacePage";

function App() {
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());
  const [screen, setScreen] = useState(() => (getCurrentUser() ? "workspace" : "home"));
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedInfoPage, setSelectedInfoPage] = useState(null);

  const buildRouteHash = (nextScreen, nextInfoPage = null) => {
    if (nextScreen !== "workspace") {
      return `#/${nextScreen}`;
    }

    return nextInfoPage ? `#/workspace/${nextInfoPage}` : "#/workspace";
  };

  const buildRouteUrl = (nextScreen, nextInfoPage = null) => {
    const nextHash = buildRouteHash(nextScreen, nextInfoPage);
    return `${window.location.pathname}${window.location.search}${nextHash}`;
  };

  const getRouteFromHash = () => {
    const fallbackScreen = getCurrentUser() ? "workspace" : "home";
    const hash = window.location.hash.replace(/^#\/?/, "");

    if (!hash) {
      return { screen: fallbackScreen, infoPage: null };
    }

    const [routeScreen, routeInfoPage] = hash.split("/");
    const allowedScreens = new Set(["home", "login", "signup", "workspace"]);
    const nextScreen = allowedScreens.has(routeScreen) ? routeScreen : fallbackScreen;

    return {
      screen: nextScreen,
      infoPage: nextScreen === "workspace" ? routeInfoPage || null : null,
    };
  };

  const applyRouteState = (nextScreen, nextInfoPage = null) => {
    setScreen(nextScreen);
    setSelectedInfoPage(nextInfoPage);
    setShowInfoMenu(false);
    setShowProfileMenu(false);
  };

  const navigateTo = (nextScreen, nextInfoPage = null, mode = "push") => {
    const state = { screen: nextScreen, infoPage: nextInfoPage };
    const nextUrl = buildRouteUrl(nextScreen, nextInfoPage);
    if (mode === "replace") {
      window.history.replaceState(state, "", nextUrl);
    } else {
      window.history.pushState(state, "", nextUrl);
    }
    applyRouteState(nextScreen, nextInfoPage);
  };

  const moveToWorkspace = (user) => {
    setCurrentUser(user);
    setCurrentUserState(user);
    navigateTo("workspace", null);
  };

  const handleUserUpdate = (user) => {
    setCurrentUser(user);
    setCurrentUserState(user);
  };

  const handleSignup = async (formData) => {
    const user = await signupUser(formData);
    moveToWorkspace(user);
  };

  const handleLogin = async ({ identifier, password }) => {
    const user = await loginUser({ identifier, password });
    moveToWorkspace(user);
  };

  const handleLogout = () => {
    clearCurrentUser();
    setCurrentUserState(null);
    navigateTo("home", null);
  };

  const handleAccountDeleted = () => {
    clearCurrentUser();
    setCurrentUserState(null);
    navigateTo("home", null);
  };

  const renderScreen = () => {
    if (screen === "login") {
      return (
        <LoginPage
          onBack={() => navigateTo("home")}
          onShowSignup={() => navigateTo("signup")}
          onSubmit={handleLogin}
        />
      );
    }

    if (screen === "signup") {
      return (
        <SignupPage
          onBack={() => navigateTo("home")}
          onShowLogin={() => navigateTo("login")}
          onSubmit={handleSignup}
        />
      );
    }

    if (screen === "workspace") {
      if (!currentUser) {
        return (
          <HomePage
            onLogin={() => navigateTo("login")}
            onSignup={() => navigateTo("signup")}
          />
        );
      }

      return (
        <WorkspacePage
          currentUser={currentUser}
          selectedInfoPage={selectedInfoPage}
          onUserUpdate={handleUserUpdate}
          onAccountDeleted={handleAccountDeleted}
        />
      );
    }

    return (
      <HomePage
        onLogin={() => navigateTo("login")}
        onSignup={() => navigateTo("signup")}
      />
    );
  };

  const isWorkspace = screen === "workspace";
  const infoPages = [
    { id: "about", label: "About Us", copy: "Company story, mission, leadership, and milestones" },
    { id: "careers", label: "Careers", copy: "Open roles, hiring flow, and work culture" },
    { id: "contact", label: "Contact Us", copy: "Inquiry forms, support paths, and response details" },
    { id: "faqs", label: "FAQs", copy: "General, billing, technical, and account answers" },
    { id: "pricing", label: "Pricing", copy: "Plans, tiers, notes, and subscription options" },
  ];
  const isAdmin = !!currentUser?.isAdmin;
  const isManagement = !!currentUser?.isManagement;
  const profileInitial = currentUser?.name ? currentUser.name.trim().charAt(0).toUpperCase() : "P";
  const userPlanName = currentUser?.subscriptionPlanName || "Free Member";
  const userPlanStatus = currentUser?.subscriptionStatus === "premium"
    ? "Premium Active"
    : currentUser?.subscriptionStatus === "expired"
      ? "Expired"
      : isAdmin
        ? "Admin Access"
        : isManagement
          ? "Management Access"
        : "Active";
  const isPremiumMember = currentUser?.subscriptionStatus === "premium";

  useEffect(() => {
    document.body.classList.toggle("workspace-body-mode", isWorkspace);

    return () => {
      document.body.classList.remove("workspace-body-mode");
    };
  }, [isWorkspace]);

  useEffect(() => {
    const initialRoute = getRouteFromHash();
    navigateTo(initialRoute.screen, initialRoute.infoPage, "replace");
  }, []);

  useEffect(() => {
    if (screen === "home" && currentUser) {
      clearCurrentUser();
      setCurrentUserState(null);
    }
  }, [screen, currentUser]);

  useEffect(() => {
    if (screen === "workspace" && !currentUser) {
      navigateTo("home", null, "replace");
    }
  }, [screen, currentUser]);

  useEffect(() => {
    const syncFromBrowserRoute = (event) => {
      const state = event.state;
      if (state?.screen) {
        applyRouteState(state.screen, state.infoPage || null);
        return;
      }

      const routeFromHash = getRouteFromHash();
      applyRouteState(routeFromHash.screen, routeFromHash.infoPage);
    };

    window.addEventListener("popstate", syncFromBrowserRoute);
    window.addEventListener("hashchange", syncFromBrowserRoute);
    return () => {
      window.removeEventListener("popstate", syncFromBrowserRoute);
      window.removeEventListener("hashchange", syncFromBrowserRoute);
    };
  }, []);

  return (
    <main
      className={`app-shell ${
        isWorkspace ? "workspace-app-shell workspace-shell-mode" : "marketing-shell-mode"
      }`}
    >
      <header className={`app-header ${isWorkspace ? "workspace-app-header" : ""}`}>
        <div className="app-header-inner">
          <div className="app-header-brand">
            <div className="app-brand-mark" aria-hidden="true">
              <span className="app-brand-mark-core" />
              <span className="app-brand-mark-orbit app-brand-mark-orbit-one" />
              <span className="app-brand-mark-orbit app-brand-mark-orbit-two" />
            </div>
            <div className="app-brand-copy">
              <div className="app-brand-title-row">
                <h2 className="app-title">{isWorkspace ? "Unified AI Workspace" : "Professional AI Platform"}</h2>
                {!isWorkspace ? <span className="app-brand-mini-tag">Trusted Platform</span> : null}
              </div>
            </div>
          </div>

          <div className="app-header-actions">
            {isWorkspace ? (
              <>
                <div className="header-menu-shell">
                  {selectedInfoPage ? (
                    <button
                      className="header-utility-button"
                      type="button"
                      onClick={() => navigateTo("workspace", null)}
                    >
                      Assistant
                    </button>
                  ) : null}
                  <button
                    className="header-utility-button"
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowInfoMenu((current) => !current);
                    }}
                  >
                    Pages
                  </button>
                  {showInfoMenu ? (
                    <div className="header-dropdown-menu">
                      {infoPages.map((page) => (
                        <button
                          key={page.id}
                          className="header-dropdown-item"
                          type="button"
                          onClick={() => navigateTo("workspace", page.id)}
                        >
                          <span className="header-dropdown-title">{page.label}</span>
                          <span className="header-dropdown-copy">{page.copy}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {currentUser ? (
                  <div className="header-user-block">
                    <button
                      className="profile-button"
                      type="button"
                      onClick={() => {
                        setShowInfoMenu(false);
                        setShowProfileMenu((current) => !current);
                      }}
                    >
                      <span className="profile-button-avatar">{profileInitial}</span>
                      <span className="profile-button-text">{currentUser.name}</span>
                      {isPremiumMember ? <span className="profile-plan-badge">Premium</span> : null}
                    </button>
                    {showProfileMenu ? (
                      <div className="profile-dropdown-menu">
                        <div className="profile-dropdown-head">
                          <div className="profile-dropdown-avatar">{profileInitial}</div>
                          <div className="profile-dropdown-meta">
                            <strong>{currentUser.name}</strong>
                            <span>{currentUser.email}</span>
                            {isPremiumMember ? <span className="profile-dropdown-badge">Premium Member</span> : null}
                          </div>
                        </div>
                        <button
                          className="header-dropdown-item"
                          type="button"
                          onClick={() => navigateTo("workspace", "profile")}
                        >
                          Profile
                        </button>
                        <button
                          className="header-dropdown-item"
                          type="button"
                          onClick={() => navigateTo("workspace", "settings")}
                        >
                          Settings
                        </button>
                        {isAdmin ? (
                          <button
                            className="header-dropdown-item"
                            type="button"
                            onClick={() => navigateTo("workspace", "administration")}
                          >
                            Administration
                          </button>
                        ) : null}
                        {(isAdmin || isManagement) ? (
                          <button
                            className="header-dropdown-item"
                            type="button"
                            onClick={() => navigateTo("workspace", "management")}
                          >
                            Management
                          </button>
                        ) : null}
                        <div className="profile-dropdown-summary">
                          <span>Plan: {userPlanName}</span>
                          <span>Status: {userPlanStatus}</span>
                        </div>
                        <button className="header-dropdown-item" type="button" onClick={handleLogout}>
                          Logout
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className={`app-body ${isWorkspace ? "workspace-app-body" : ""}`}>{renderScreen()}</div>
    </main>
  );
}

export default App;
