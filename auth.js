/**
 * Thrive Auth Wrapper
 *
 * Include this script at the top of every page.
 * Checks for a valid Microsoft SSO session, redirects to login if needed.
 * Injects user badge + logout button into the nav bar.
 */
(function() {
  "use strict";

  var AUTH_BASE = "https://standing-malamute-183.convex.site";
  var LOGIN_PATH = "/login.html";
  var VERIFY_TIMEOUT = 5000;

  // Pages that don't require auth
  var PUBLIC_PAGES = ["/login.html", "/auth-callback.html"];
  var currentPath = window.location.pathname;
  for (var i = 0; i < PUBLIC_PAGES.length; i++) {
    if (currentPath === PUBLIC_PAGES[i]) return;
  }

  // Hide page content until auth check completes
  document.documentElement.style.opacity = "0";
  document.documentElement.style.transition = "opacity 0.3s ease";

  var token = localStorage.getItem("thrive_session_token");

  if (!token) {
    window.location.href = LOGIN_PATH + "?redirect=" + encodeURIComponent(currentPath);
    return;
  }

  // Verify session
  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, VERIFY_TIMEOUT);

  fetch(AUTH_BASE + "/auth/verify-ms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token }),
    signal: controller.signal,
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    clearTimeout(timeoutId);
    if (data.valid && data.user) {
      localStorage.setItem("thrive_user", JSON.stringify(data.user));
      window.__THRIVE_USER = data.user;
      showPage();
      injectUserBadge(data.user);
      applyRoleGating(data.user);
    } else {
      localStorage.removeItem("thrive_session_token");
      localStorage.removeItem("thrive_user");
      window.location.href = LOGIN_PATH + "?redirect=" + encodeURIComponent(currentPath);
    }
  })
  .catch(function() {
    clearTimeout(timeoutId);
    // Network error - try cached user info
    var cached = localStorage.getItem("thrive_user");
    if (cached) {
      try {
        var user = JSON.parse(cached);
        window.__THRIVE_USER = user;
        showPage();
        injectUserBadge(user);
        applyRoleGating(user);
      } catch (e) {
        window.location.href = LOGIN_PATH + "?redirect=" + encodeURIComponent(currentPath);
      }
    } else {
      window.location.href = LOGIN_PATH + "?redirect=" + encodeURIComponent(currentPath);
    }
  });

  function showPage() {
    document.documentElement.style.opacity = "1";
  }

  function injectUserBadge(user) {
    var nav = document.querySelector("nav");
    if (!nav) return;

    var badge = document.createElement("div");
    badge.style.cssText = "display:flex;align-items:center;gap:8px;margin-left:auto;";

    // Name + role
    var nameEl = document.createElement("span");
    nameEl.style.cssText = "font-size:12px;color:#aaa;";
    nameEl.textContent = user.displayName;
    if (user.role === "owner") {
      nameEl.innerHTML += " <span style='color:#22c55e;font-size:10px;background:rgba(34,197,94,0.15);padding:2px 6px;border-radius:4px;'>OWNER</span>";
    } else if (user.role === "manager") {
      nameEl.innerHTML += " <span style='color:#4a90e2;font-size:10px;background:rgba(74,144,226,0.15);padding:2px 6px;border-radius:4px;'>MANAGER</span>";
    }
    badge.appendChild(nameEl);

    // Logout button
    var logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Sign Out";
    logoutBtn.style.cssText = "background:transparent;border:1px solid rgba(255,255,255,0.15);color:#888;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;margin-left:4px;";
    logoutBtn.addEventListener("mouseover", function() { this.style.borderColor = "rgba(255,59,48,0.5)"; this.style.color = "#ff6b6b"; });
    logoutBtn.addEventListener("mouseout", function() { this.style.borderColor = "rgba(255,255,255,0.15)"; this.style.color = "#888"; });
    logoutBtn.addEventListener("click", function() {
      fetch(AUTH_BASE + "/auth/logout-ms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: localStorage.getItem("thrive_session_token") }),
      }).catch(function() {});
      localStorage.removeItem("thrive_session_token");
      localStorage.removeItem("thrive_user");
      window.location.href = "/login.html";
    });
    badge.appendChild(logoutBtn);

    nav.appendChild(badge);
  }

  function applyRoleGating(user) {
    var gated = document.querySelectorAll("[data-role-min]");
    for (var j = 0; j < gated.length; j++) {
      var minRole = gated[j].getAttribute("data-role-min");
      if (minRole === "owner" && user.role !== "owner") {
        gated[j].style.display = "none";
      }
      if (minRole === "manager" && user.role === "staff") {
        gated[j].style.display = "none";
      }
    }
    window.__THRIVE_ROLE = user.role;
  }
})();
