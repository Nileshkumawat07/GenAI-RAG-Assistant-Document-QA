import React, { useCallback, useEffect, useRef, useState } from "react";

import HomePage from "./features/auth/HomePage";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import CommandPalette from "./shared/components/CommandPalette";
import GlobalToastViewport from "./shared/components/GlobalToastViewport";
import { fetchCurrentSessionUser, loginUser, signupUser } from "./features/auth/authApi";
import {
  clearAuthNotice,
  clearCurrentUser,
  getAuthNotice,
  getCurrentUser,
  setCurrentUser,
} from "./features/auth/authStorage";
import WorkspacePage from "./features/workspace/WorkspacePage";
import { getPublishedContentEntries } from "./features/info/aboutContentApi";
import { getChatWebSocketUrl } from "./features/workspace/chatManagementApi";
import {
  getWorkspaceDashboard,
  getWorkspaceNotifications,
  markAllWorkspaceNotificationsRead,
  markWorkspaceNotificationRead,
} from "./features/workspace/workspaceHubApi";
import { buildAppSearchItems } from "./shared/search/appSearchIndex";
import { pushToast } from "./shared/toast/toastBus";

let socket = null;
function App() {
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());
  const [screen, setScreen] = useState(() => (getCurrentUser() ? "workspace" : "home"));
  const [authNotice, setAuthNotice] = useState(() => getAuthNotice());
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [selectedInfoPage, setSelectedInfoPage] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [searchContentEntries, setSearchContentEntries] = useState({});
  const [toasts, setToasts] = useState([]);
  const [headerNotifications, setHeaderNotifications] = useState([]);
  const [headerRecentActivity, setHeaderRecentActivity] = useState([]);
  const [headerNotificationsLoading, setHeaderNotificationsLoading] = useState(false);
  const headerSocketRef = useRef(null);
  const headerRefreshTimeoutRef = useRef(null);
  const headerSocketReconnectTimeoutRef = useRef(null);
  const headerSocketReconnectAttemptRef = useRef(0);

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
    setShowNotificationMenu(false);
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
    clearAuthNotice();
    setAuthNotice("");
    setCurrentUser(user);
    setCurrentUserState(user);
    pushToast({ type: "success", title: "Welcome back", message: "Your workspace is ready." });
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
    clearAuthNotice();
    setAuthNotice("");
    pushToast({ type: "info", title: "Signed out", message: "You have been logged out safely." });
    navigateTo("home", null);
  };

  const handleAccountDeleted = () => {
    clearCurrentUser();
    setCurrentUserState(null);
    clearAuthNotice();
    setAuthNotice("");
    navigateTo("home", null);
  };

  const handleForcedLogout = (message = "Your session expired. Please log in again.") => {
    clearCurrentUser();
    setCurrentUserState(null);
    setAuthNotice(message);
    navigateTo("login", null, "replace");
  };

  const renderScreen = () => {
    if (screen === "login") {
      return (
        <LoginPage
          onBack={() => navigateTo("home")}
          onShowSignup={() => navigateTo("signup")}
          initialError={authNotice}
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
    { id: "help", label: "Help Center", copy: "Help docs, bug reporting, feature requests, and support history" },
    { id: "trust", label: "Trust Center", copy: "Privacy, terms, refunds, security, and status guidance" },
  ];
  const isAdmin = !!currentUser?.isAdmin;
  const isManagement = !!currentUser?.isManagement;
  const profileDisplayName = currentUser?.fullName || currentUser?.name || "Profile";
  const profileInitial = profileDisplayName ? profileDisplayName.trim().charAt(0).toUpperCase() : "P";
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
  const unreadHeaderNotifications = headerNotifications.filter((item) => !item.isRead).length;
  const commandPaletteItems = buildAppSearchItems({
    navigateTo,
    isAdmin,
    isManagement,
    contentEntriesByPage: searchContentEntries,
  });
  const filteredCommandPaletteItems = commandPaletteItems.filter((item) => {
    const query = commandPaletteQuery.trim().toLowerCase();
    if (!query) return true;
    return `${item.label} ${item.description} ${item.group} ${item.searchText || ""}`.toLowerCase().includes(query);
  });

  const loadHeaderNotifications = useCallback(async () => {
    if (!currentUser?.id || screen !== "workspace") {
      return;
    }
    try {
      setHeaderNotificationsLoading(true);
      const [items, dashboard] = await Promise.all([
        getWorkspaceNotifications(),
        getWorkspaceDashboard(),
      ]);
      setHeaderNotifications(items || []);
      setHeaderRecentActivity(dashboard?.recentActivity || []);
    } catch {
      setHeaderNotifications([]);
      setHeaderRecentActivity([]);
    } finally {
      setHeaderNotificationsLoading(false);
    }
  }, [currentUser?.id, screen]);

  const applySocketNotification = useCallback((notification) => {
    if (!notification?.id) {
      return;
    }
    setHeaderNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
    setHeaderRecentActivity((current) => [
      {
        id: notification.id,
        title: notification.title,
        detail: notification.message,
        category: notification.category,
        createdAt: notification.createdAt,
        tone: notification.isRead ? "success" : "info",
      },
      ...current.filter((item) => item.id !== notification.id),
    ].slice(0, 6));
  }, []);

  const handleHeaderNotificationRead = async (notificationId) => {
    try {
      await markWorkspaceNotificationRead(notificationId);
      setHeaderNotifications((current) =>
        current.map((item) => (
          item.id === notificationId
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        ))
      );
    } catch {
      // Keep the existing list if marking fails.
    }
  };

  const handleHeaderNotificationOpen = async (notification) => {
    if (!notification) return;
    await handleHeaderNotificationRead(notification.id);
    if (!notification.actionType) {
      return;
    }
    try {
      window.sessionStorage.setItem(
        "genai_chat_navigation_target",
        JSON.stringify({
          actionType: notification.actionType,
          actionEntityId: notification.actionEntityId || "",
          actionEntityKind: notification.actionEntityKind || "",
          actionContext: notification.actionContext || {},
        })
      );
    } catch {
      // Ignore storage failures.
    }
    navigateTo("workspace", null);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("genai-open-chat-management"));
    }, 0);
  };

  const handleHeaderNotificationsReadAll = async () => {
    try {
      await markAllWorkspaceNotificationsRead();
      setHeaderNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      pushToast({ type: "success", title: "Notifications cleared", message: "All notifications were marked as read." });
    } catch {
      // Ignore header mark-all failure silently here.
    }
  };

  useEffect(() => {
    const handleToast = (event) => {
      const detail = event?.detail || {};
      const nextToast = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: detail.type || "info",
        title: detail.title || "Workspace update",
        message: detail.message || detail.text || "An update is available.",
      };
      setToasts((current) => [...current, nextToast].slice(-5));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== nextToast.id));
      }, 3600);
    };

    window.addEventListener("genai-toast", handleToast);
    return () => {
      window.removeEventListener("genai-toast", handleToast);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSearchContent() {
      const pageKeys = ["about", "faqs", "pricing", "help", "trust"];
      const results = await Promise.allSettled(pageKeys.map((pageKey) => getPublishedContentEntries(pageKey)));
      if (!active) {
        return;
      }
      const nextEntries = {};
      pageKeys.forEach((pageKey, index) => {
        const result = results[index];
        nextEntries[pageKey] = result.status === "fulfilled" ? result.value?.entries || [] : [];
      });
      setSearchContentEntries(nextEntries);
    }

    if (screen === "workspace") {
      loadSearchContent();
    }

    return () => {
      active = false;
    };
  }, [screen]);

  useEffect(() => {
    const handleKeydown = (event) => {
      if (screen !== "workspace") return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        setShowInfoMenu(false);
        setShowProfileMenu(false);
        setShowNotificationMenu(false);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [screen]);

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
    if (screen !== "login" || !authNotice) {
      return;
    }
    clearAuthNotice();
  }, [screen, authNotice]);

  useEffect(() => {
    if (screen === "workspace" && !currentUser) {
      navigateTo("home", null, "replace");
    }
  }, [screen, currentUser]);

  useEffect(() => {
    if (!currentUser || screen !== "workspace") {
      setHeaderNotifications([]);
      setHeaderRecentActivity([]);
      return;
    }

    loadHeaderNotifications();
  }, [currentUser?.id, screen, loadHeaderNotifications]);

  useEffect(() => {
    if (!currentUser || screen !== "workspace") {
      window.clearTimeout(headerRefreshTimeoutRef.current);
      window.clearTimeout(headerSocketReconnectTimeoutRef.current);
      if (headerSocketRef.current) {
        headerSocketRef.current.close();
        headerSocketRef.current = null;
      }
      return undefined;
    }

    let disposed = false;

    const handleSocketSend = (event) => {
      const payload = event?.detail;
      const socket = headerSocketRef.current;
      if (!payload || !socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        socket.send(JSON.stringify(payload));
      } catch {
        // Ignore socket send failures here.
      }
    };

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }
      window.clearTimeout(headerSocketReconnectTimeoutRef.current);
      const reconnectDelay = Math.min(1000 * (2 ** headerSocketReconnectAttemptRef.current), 10000);
      headerSocketReconnectTimeoutRef.current = window.setTimeout(() => {
        connectChatSocket();
      }, reconnectDelay);
      headerSocketReconnectAttemptRef.current += 1;
    };
   
    const connectChatSocket = () => {
      if (disposed) {
        return;
      }

      window.socket = new WebSocket(getChatWebSocketUrl());
      socket = window.socket;
      headerSocketRef.current = socket;

      socket.onopen = () => {
        if (disposed || headerSocketRef.current !== socket) {
          return;
        }
        headerSocketReconnectAttemptRef.current = 0;
        window.__GENAI_CHAT_SOCKET_READY__ = true;
        window.dispatchEvent(new CustomEvent("genai-chat-socket-open"));
      };

      socket.onclose = () => {
        if (headerSocketRef.current === socket) {
          headerSocketRef.current = null;
        }
        window.__GENAI_CHAT_SOCKET_READY__ = false;
        window.dispatchEvent(new CustomEvent("genai-chat-socket-close"));
        scheduleReconnect();
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch {
          // Ignore forced close failures.
        }
      };

      socket.onmessage = (event) => {
        console.log("SOCKET MESSAGE:", event.data);
        try {
          const payload = JSON.parse(event.data);
          console.log("SOCKET PARSED:", payload);
          window.dispatchEvent(new CustomEvent("genai-chat-socket-message", { detail: payload }));
          if (payload.type === "notification:new" && payload.notification) {
            applySocketNotification(payload.notification);
          }
        } catch (error) {
          console.error("SOCKET ERROR:", error);
        }
      };
    };

    connectChatSocket();
    window.addEventListener("genai-chat-socket-send", handleSocketSend);

    return () => {
      disposed = true;
      window.clearTimeout(headerRefreshTimeoutRef.current);
      window.clearTimeout(headerSocketReconnectTimeoutRef.current);
      window.removeEventListener("genai-chat-socket-send", handleSocketSend);
      window.__GENAI_CHAT_SOCKET_READY__ = false;
      if (headerSocketRef.current) {
        headerSocketRef.current.close();
        headerSocketRef.current = null;
      }
    };
  }, [applySocketNotification, currentUser?.id, screen]);

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

  useEffect(() => {
    if (!currentUser || screen !== "workspace") {
      return undefined;
    }

    let active = true;
    const refreshCurrentUser = async () => {
      try {
        const latestUser = await fetchCurrentSessionUser();
        if (active) {
          handleUserUpdate(latestUser);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        if (/session|token|authorization|authentication|signed out|expired/i.test(error.message || "")) {
          handleForcedLogout("Your session ended because this device was signed out. Please log in again.");
        }
      }
    };

    refreshCurrentUser();
    window.addEventListener("focus", refreshCurrentUser);
    const intervalId = window.setInterval(refreshCurrentUser, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCurrentUser);
    };
  }, [currentUser, screen]);

  useEffect(() => {
    const handleInvalidated = (event) => {
      handleForcedLogout(event?.detail?.message || "Your session expired. Please log in again.");
    };

    window.addEventListener("genai-auth-invalidated", handleInvalidated);
    return () => {
      window.removeEventListener("genai-auth-invalidated", handleInvalidated);
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
                    Company
                  </button>
                  <button
                    className="header-utility-button"
                    type="button"
                    onClick={() => setCommandPaletteOpen(true)}
                  >
                    Search
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
                    <div className="header-menu-shell">
                      <button
                        className="header-notification-button"
                        type="button"
                        aria-label="Notifications"
                        onClick={() => {
                          setShowInfoMenu(false);
                          setShowProfileMenu(false);
                          setShowNotificationMenu((current) => !current);
                          if (!showNotificationMenu) {
                            loadHeaderNotifications();
                          }
                        }}
                      >
                        <span className="header-notification-bell" aria-hidden="true">
                          <span className="header-notification-bell-body" />
                          <span className="header-notification-bell-clapper" />
                        </span>
                        {unreadHeaderNotifications > 0 ? (
                          <span className="header-notification-badge">
                            {unreadHeaderNotifications > 9 ? "9+" : unreadHeaderNotifications}
                          </span>
                        ) : null}
                      </button>
                      {showNotificationMenu ? (
                        <div className="header-dropdown-menu header-notification-menu">
                          <div className="header-notification-menu-head">
                            <div>
                              <strong>Notifications</strong>
                              <span>{unreadHeaderNotifications} unread</span>
                            </div>
                            <button
                              className="header-notification-link"
                              type="button"
                              onClick={handleHeaderNotificationsReadAll}
                              disabled={headerNotificationsLoading || headerNotifications.length === 0}
                            >
                              Mark all read
                            </button>
                          </div>
                          <div className="header-notification-list">
                            {headerNotificationsLoading ? (
                              <p className="header-dropdown-copy">Loading notifications...</p>
                            ) : headerNotifications.length > 0 ? (
                              headerNotifications.slice(0, 6).map((item) => (
                                <button
                                  key={item.id}
                                  className={`header-dropdown-item header-notification-item ${item.isRead ? "is-read" : ""}`}
                                  type="button"
                                  onClick={() => handleHeaderNotificationOpen(item)}
                                >
                                  <span className="header-dropdown-title">{item.title}</span>
                                  <span className="header-dropdown-copy">{item.message}</span>
                                </button>
                              ))
                            ) : (
                              <p className="header-dropdown-copy">No notifications yet.</p>
                            )}
                          </div>
                          <div className="header-notification-menu-head">
                            <div>
                              <strong>Recent Activity</strong>
                              <span>{headerRecentActivity.length} items</span>
                            </div>
                          </div>
                          <div className="header-notification-list">
                            {headerNotificationsLoading ? (
                              <p className="header-dropdown-copy">Loading recent activity...</p>
                            ) : headerRecentActivity.length > 0 ? (
                              headerRecentActivity.slice(0, 6).map((item) => (
                                <div key={item.id} className="header-dropdown-item header-notification-item is-read">
                                  <span className="header-dropdown-title">{item.title}</span>
                                  <span className="header-dropdown-copy">{item.detail}</span>
                                  <span className="header-dropdown-copy">
                                    {item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Just now"}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="header-dropdown-copy">No recent activity yet.</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="profile-button"
                      type="button"
                      onClick={() => {
                        setShowInfoMenu(false);
                        setShowNotificationMenu(false);
                        setShowProfileMenu((current) => !current);
                      }}
                    >
                      <span className="profile-button-avatar">{profileInitial}</span>
                      <span className="profile-button-text">{profileDisplayName}</span>
                      {isPremiumMember ? <span className="profile-plan-badge">Premium</span> : null}
                    </button>
                    {showProfileMenu ? (
                      <div className="profile-dropdown-menu">
                        <div className="profile-dropdown-head">
                          <div className="profile-dropdown-avatar">{profileInitial}</div>
                          <div className="profile-dropdown-meta">
                            <strong>{profileDisplayName}</strong>
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
      <CommandPalette
        open={commandPaletteOpen}
        query={commandPaletteQuery}
        items={filteredCommandPaletteItems}
        onClose={() => {
          setCommandPaletteOpen(false);
          setCommandPaletteQuery("");
        }}
        onQueryChange={setCommandPaletteQuery}
        onSelect={(item) => {
          setCommandPaletteOpen(false);
          setCommandPaletteQuery("");
          item.action();
        }}
      />
      <GlobalToastViewport
        toasts={toasts}
        onDismiss={(toastId) => setToasts((current) => current.filter((item) => item.id !== toastId))}
      />
    </main>
  );
}

export default App;
