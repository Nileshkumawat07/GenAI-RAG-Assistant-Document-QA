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

  const moveToWorkspace = (user) => {
    setCurrentUser(user);
    setCurrentUserState(user);
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
      return <WorkspacePage />;
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
            <p className="app-kicker">GenAI Assistant</p>
            {!isWorkspace ? (
              <h2 className="app-title">AI Platform Home</h2>
            ) : null}
          </div>

          <div className="app-header-actions">
            {currentUser ? (
              <div className="header-user-block">
                <span className="app-header-badge">
                  {currentUser.mode === "guest" ? "Guest Access" : currentUser.name}
                </span>
                <button className="header-logout-button" type="button" onClick={handleLogout}>
                  Logout
                </button>
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
