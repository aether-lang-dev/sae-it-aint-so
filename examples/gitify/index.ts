"seal except ui, http, shell, storage";   // all this app names (docs/app-capabilities.md)
// Gitify, as a sae app. Ported from gitify-app/gitify (MIT; see NOTICE.md):
// your GitHub notifications, grouped by repository, to open, mark read or
// mark done. Signs in with a personal access token, to github.com or a
// GitHub Enterprise host, as Gitify does.
//
// One page with three views (sign in, notifications, settings). The GitHub
// calls are Gitify's (forges/github/client.ts): same endpoints, same headers.
// They run on sae's http, which runs them on Aether actors; app.json grants
// api.github.com and nothing else, and shell.open github.com.
const { vstack, hstack, text, btn, divider, textfield, get_text, set_text,
        toggle, set_toggle, scroll, clear, into, styles, add_class, style_id,
        set_visible, timer, timer_cancel } = ui;

interface Res { ok: boolean; status: number; text: string; error: string; headers: any; json(): any }
interface Account { host: string; token: string; login: string; id: number }
interface Note {
  id: string; unread: boolean; reason: string; updated_at: string;
  subject: { title: string; url: string | null; latest_comment_url: string | null; type: string };
  repository: { full_name: string; html_url: string };
}

// --- Gitify's vocabulary (utils/notifications/reason.ts, types.ts) ---

const REASON: { [r: string]: string } = {
  approval_requested: "Approval Requested", assign: "Assigned", author: "Authored",
  ci_activity: "Workflow Run Completed", comment: "Commented", invitation: "Invitation Received",
  manual: "Updated", member_feature_requested: "Member Feature Requested", mention: "Mentioned",
  review_requested: "Review Requested", security_advisory_credit: "Security Advisory Credit Received",
  security_alert: "Security Alert Received", state_change: "State Changed", subscribed: "Updated",
  team_mention: "Team Mentioned",
};
const TYPE: { [t: string]: string } = {
  CheckSuite: "Check suite", Commit: "Commit", Discussion: "Discussion", Issue: "Issue",
  PullRequest: "Pull request", Release: "Release", RepositoryAdvisory: "Advisory",
  RepositoryDependabotAlertsThread: "Dependabot", RepositoryInvitation: "Invitation",
  RepositoryVulnerabilityAlert: "Vulnerability", WorkflowRun: "Workflow run",
};

// --- state, persisted in app storage ---

const loadJson = (key: string, dflt: any): any => {
  const s = storage.get(key);
  if (s === null) return dflt;
  try { return JSON.parse(s); } catch (e) { return dflt; }
};
let account: Account | null = loadJson("account", null);
let settings = loadJson("settings", { participating: false, markOnOpen: true });
const saveSettings = (): void => storage.set("settings", JSON.stringify(settings));

let notes: Note[] = [];
let pollTimer = 0;
let pollSeconds = 60;

// --- GitHub's REST API, as Gitify calls it ---

const apiBase = (host: string): string => {
  if (host === "github.com") return "https://api.github.com";
  const origin = host.indexOf("://") > 0 ? host : `https://${host}`;
  return `${origin}/api/v3`;       // GitHub Enterprise Server
};

const gh = (method: string, urlOrPath: string, cb: (res: Res) => void): void => {
  const a = account as Account;
  const url = urlOrPath.indexOf("://") > 0 ? urlOrPath : apiBase(a.host) + urlOrPath;
  http.request({
    method: method, url: url,
    headers: { Authorization: `token ${a.token}`, Accept: "application/vnd.github+json",
               "User-Agent": "sae-gitify" },
  }, cb);
};

const failure = (res: Res): string =>
  res.error !== "" ? res.error : res.status === 401 ? "the token was rejected (401)" : `GitHub answered ${res.status}`;

// --- small helpers mquickjs does not have: base64 (btoa) and ISO dates ---

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64 = (s: string): string => {
  let out = "";
  for (let i = 0; i < s.length; i += 3) {
    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63) +
           (i + 1 < s.length ? B64.charAt((n >> 6) & 63) : "=") +
           (i + 2 < s.length ? B64.charAt(n & 63) : "=");
  }
  return out;
};

// "2026-10-03T12:34:56Z" -> epoch ms (days from the civil calendar).
const isoMs = (s: string): number => {
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400), yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const days = era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
  return ((days * 24 + +s.slice(11, 13)) * 60 + +s.slice(14, 16)) * 60000 + +s.slice(17, 19) * 1000;
};

const ago = (iso: string): string => {
  const s = Math.max(0, Math.floor((Date.now() - isoMs(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const dd = Math.floor(h / 24);
  return dd === 1 ? "yesterday" : `${dd} days ago`;
};

// --- look ---

styles({
  root: { font_family: "sans-serif" },
  "#title": { font_size: 18, font_weight: "bold", color: "#24292f" },
  "repo.label": { font_weight: "bold", color: "#24292f" },
  "meta.label": { color: "#57606a" },
  "#status": { color: "#cf222e" },
  button: { color: "#0969da" },
});

// --- views ---

let views: number[] = [];
const show = (i: number): void => views.forEach((v: number, j: number) => set_visible(v, j === i));

let hostField = 0, tokenField = 0, loginStatus = 0;
let whoText = 0, countText = 0, listStatus = 0, listBox = 0;

// Sign in (Gitify's LoginWithPersonalAccessTokenForm)
views.push(vstack(8, () => {
  style_id(text("Gitify"), "title");
  text("Sign in with a personal access token");
  add_class(text("Scopes: notifications, read:user, repo"), "meta");
  text("Hostname");
  hostField = textfield("github.com", (s: string) => {});
  text("Token");
  tokenField = textfield("ghp_...", (s: string) => {});
  btn("Sign in", () => signIn());
  loginStatus = text("");
  style_id(loginStatus, "status");
}));

// Notifications (Gitify's Notifications route)
views.push(vstack(6, () => {
  hstack(6, () => {
    whoText = text("");
    style_id(whoText, "title");
  });
  hstack(4, () => {
    btn("Refresh", () => refresh());
    btn("Mark all read", () => markAllRead());
    btn("Settings", () => show(2));
  });
  countText = text("");
  add_class(countText, "meta");
  listStatus = text("");
  style_id(listStatus, "status");
  divider();
  scroll(() => { listBox = vstack(6, () => {}); });
}));

// Settings (a few of Gitify's)
let partToggle = 0, markToggle = 0;
views.push(vstack(8, () => {
  style_id(text("Settings"), "title");
  partToggle = toggle("Show only participating", (on: number) => {
    settings.participating = on === 1; saveSettings(); refresh();
  });
  markToggle = toggle("Mark as read when opened", (on: number) => {
    settings.markOnOpen = on === 1; saveSettings();
  });
  btn("Sign out", () => signOut());
  btn("Back", () => show(1));
}));
if (settings.participating) set_toggle(partToggle, 1);
if (settings.markOnOpen) set_toggle(markToggle, 1);

// --- sign in and out ---

const signIn = (): void => {
  const host = get_text(hostField).trim() || "github.com";
  const token = get_text(tokenField).trim();
  if (token === "") { set_text(loginStatus, "A token is needed"); return; }
  account = { host: host, token: token, login: "", id: 0 };
  set_text(loginStatus, "Checking the token...");
  gh("GET", "/user", (res: Res) => {
    if (!res.ok) { set_text(loginStatus, `Could not sign in: ${failure(res)}`); account = null; return; }
    const u = res.json();
    (account as Account).login = u.login;
    (account as Account).id = u.id;
    storage.set("account", JSON.stringify(account));
    set_text(loginStatus, "");
    startList();
  });
};

const signOut = (): void => {
  if (pollTimer !== 0) { timer_cancel(pollTimer); pollTimer = 0; }
  storage.remove("account");
  account = null;
  notes = [];
  clear(listBox);
  set_text(tokenField, "");
  show(0);
};

// --- the list ---

const startList = (): void => {
  const a = account as Account;
  set_text(whoText, `@${a.login}${a.host === "github.com" ? "" : " on " + a.host}`);
  show(1);
  refresh();
};

const schedule = (): void => {
  if (pollTimer !== 0) timer_cancel(pollTimer);
  pollTimer = timer(pollSeconds * 1000, () => refresh());
};

const refresh = (): void => {
  if (account === null) return;
  set_text(listStatus, "");
  const q = `?participating=${settings.participating ? "true" : "false"}&per_page=50`;
  gh("GET", `/notifications${q}`, (res: Res) => {
    if (!res.ok) { set_text(listStatus, `Could not load notifications: ${failure(res)}`); return; }
    // GitHub says how often it may be polled (Gitify's pollInterval).
    const every = +res.headers["x-poll-interval"];
    if (every > 0) pollSeconds = every;
    notes = res.json();
    render();
    schedule();
  });
};

const render = (): void => {
  set_text(countText, notes.length === 0 ? "No new notifications" :
           notes.length === 1 ? "1 notification" : `${notes.length} notifications`);
  // Group by repository, in the order GitHub listed them.
  const order: string[] = [];
  const byRepo: { [r: string]: Note[] } = {};
  notes.forEach((n: Note) => {
    const r = n.repository.full_name;
    if (!byRepo[r]) { byRepo[r] = []; order.push(r); }
    byRepo[r].push(n);
  });
  clear(listBox);
  into(listBox, () => {
    order.forEach((repo: string) => {
      hstack(6, () => {
        add_class(text(repo), "repo");
        btn("Mark repo read", () => markRepoRead(repo));
      });
      byRepo[repo].forEach((n: Note) => {
        vstack(2, () => {
          text(`${TYPE[n.subject.type] || n.subject.type}: ${n.subject.title}`);
          add_class(text(`${REASON[n.reason] || "Unknown"} · ${ago(n.updated_at)}`), "meta");
          hstack(4, () => {
            btn("Open", () => openNote(n));
            btn("Read", () => markRead(n));
            btn("Done", () => markDone(n));
          });
        });
      });
      divider();
    });
  });
};

const drop = (pred: (n: Note) => boolean): void => {
  notes = notes.filter((n: Note) => !pred(n));
  render();
};

// --- Gitify's mutations (client.ts) ---

const markRead = (n: Note): void =>
  gh("PATCH", `/notifications/threads/${n.id}`, (res: Res) => {
    if (res.ok) drop((x: Note) => x.id === n.id); else set_text(listStatus, `Mark read failed: ${failure(res)}`);
  });

const markDone = (n: Note): void =>
  gh("DELETE", `/notifications/threads/${n.id}`, (res: Res) => {
    if (res.ok) drop((x: Note) => x.id === n.id); else set_text(listStatus, `Mark done failed: ${failure(res)}`);
  });

const markRepoRead = (repo: string): void =>
  gh("PUT", `/repos/${repo}/notifications`, (res: Res) => {
    if (res.ok) drop((x: Note) => x.repository.full_name === repo);
    else set_text(listStatus, `Mark repository read failed: ${failure(res)}`);
  });

const markAllRead = (): void =>
  gh("PUT", "/notifications", (res: Res) => {
    if (res.ok) drop((x: Note) => true); else set_text(listStatus, `Mark all read failed: ${failure(res)}`);
  });

// Open in the browser (Gitify's generateNotificationWebUrl): follow the
// subject's API URL to its html_url, add Gitify's referrer id, and hand it
// to the system.
const openNote = (n: Note): void => {
  const a = account as Account;
  const ref = base64(`018:NotificationThread${n.id}:${a.id}`);
  const go = (html: string): void => {
    try {
      shell.open(`${html}${html.indexOf("?") >= 0 ? "&" : "?"}notification_referrer_id=${ref}`);
    } catch (e) {
      set_text(listStatus, e.message);
      return;
    }
    if (settings.markOnOpen) markRead(n);
  };
  const follow = n.subject.latest_comment_url || n.subject.url;
  if (!follow) { go(n.repository.html_url); return; }
  gh("GET", follow, (res: Res) => go(res.ok ? res.json().html_url : n.repository.html_url));
};

// --- start ---

if (account !== null) startList(); else show(0);
