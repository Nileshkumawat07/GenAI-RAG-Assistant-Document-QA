import React, { useEffect, useState } from "react";

import HomePage from "./features/auth/HomePage";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import {
  authenticateUser,
  clearCurrentUser,
  getCurrentUser,
  registerUser,
  setCurrentUser,
} from "./features/auth/authStorage";
import WorkspacePage from "./features/workspace/WorkspacePage";

function App() {
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());
  const [screen, setScreen] = useState(() => (getCurrentUser() ? "workspace" : "home"));
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedInfoPage, setSelectedInfoPage] = useState(null);

  const moveToWorkspace = (user) => {
    setCurrentUser(user);
    setCurrentUserState(user);
    setSelectedInfoPage(null);
    setScreen("workspace");
  };

  const handleSignup = (formData) => {
    const savedUser = registerUser(formData);
    moveToWorkspace({
      name: savedUser.fullName,
      email: savedUser.email,
      mode: "member",
    });
  };

  const handleLogin = ({ identifier, password }) => {
    const user = authenticateUser(identifier, password);
    moveToWorkspace({
      name: user.fullName,
      email: user.email,
      mode: "member",
    });
  };

  const handleGuestEntry = () => {
    moveToWorkspace({
      name: "Guest User",
      email: "guest@local.demo",
      mode: "guest",
    });
  };

  const handleLogout = () => {
    clearCurrentUser();
    setCurrentUserState(null);
    setSelectedInfoPage(null);
    setScreen("home");
  };

  const renderScreen = () => {
    if (screen === "login") {
      return (
        <LoginPage
          onBack={() => setScreen("home")}
          onBypass={handleGuestEntry}
          onShowSignup={() => setScreen("signup")}
          onSubmit={handleLogin}
        />
      );
    }

    if (screen === "signup") {
      return (
        <SignupPage
          onBack={() => setScreen("home")}
          onBypass={handleGuestEntry}
          onShowLogin={() => setScreen("login")}
          onSubmit={handleSignup}
        />
      );
    }

    if (screen === "workspace") {
      return <WorkspacePage currentUser={currentUser} selectedInfoPage={selectedInfoPage} />;
    }

    return (
      <HomePage
        onContinue={handleGuestEntry}
        onLogin={() => setScreen("login")}
        onSignup={() => setScreen("signup")}
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
  const profileInitial = currentUser?.name ? currentUser.name.trim().charAt(0).toUpperCase() : "P";

  useEffect(() => {
    document.body.classList.toggle("workspace-body-mode", isWorkspace);

    return () => {
      document.body.classList.remove("workspace-body-mode");
    };
  }, [isWorkspace]);

  return (
    <main
      className={`app-shell ${
        isWorkspace ? "workspace-app-shell workspace-shell-mode" : "marketing-shell-mode"
      }`}
    >
      <header className={`app-header ${isWorkspace ? "workspace-app-header" : ""}`}>
        <div className="app-header-inner">
          <div>
            {!isWorkspace ? (
              <h2 className="app-title">AI Platform Home</h2>
            ) : null}
          </div>

          <div className="app-header-actions">
            <div className="header-menu-shell">
              {selectedInfoPage ? (
                <button
                  className="header-utility-button"
                  type="button"
                  onClick={() => {
                    setSelectedInfoPage(null);
                    setShowInfoMenu(false);
                  }}
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
                      onClick={() => {
                        setSelectedInfoPage(page.id);
                        setScreen("workspace");
                        setShowInfoMenu(false);
                      }}
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
                  <span className="profile-button-text">
                    {currentUser.mode === "guest" ? "Guest Access" : currentUser.name}
                  </span>
                </button>
                {showProfileMenu ? (
                  <div className="profile-dropdown-menu">
                    <div className="profile-dropdown-head">
                      <div className="profile-dropdown-avatar">{profileInitial}</div>
                      <div className="profile-dropdown-meta">
                        <strong>{currentUser.mode === "guest" ? "Guest Access" : currentUser.name}</strong>
                        <span>{currentUser.email}</span>
                      </div>
                    </div>
                    <button
                      className="header-dropdown-item"
                      type="button"
                      onClick={() => {
                        setSelectedInfoPage("profile");
                        setScreen("workspace");
                        setShowProfileMenu(false);
                      }}
                    >
                      Profile
                    </button>
                    <button
                      className="header-dropdown-item"
                      type="button"
                      onClick={() => {
                        setSelectedInfoPage("settings");
                        setScreen("workspace");
                        setShowProfileMenu(false);
                      }}
                    >
                      Settings
                    </button>
                    <div className="profile-dropdown-summary">
                      <span>Plan: {currentUser.mode === "guest" ? "Guest Access" : "Pro Member"}</span>
                      <span>Status: Active</span>
                    </div>
                    <button className="header-dropdown-item" type="button" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <span className="app-header-badge">Live</span>
            )}
          </div>
        </div>
      </header>

      <div className={`app-body ${isWorkspace ? "workspace-app-body" : ""}`}>{renderScreen()}</div>
    </main>
  );
}

export default App;
