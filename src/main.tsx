import { hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import type { Seed } from "./app/data";
import "./tokens.css";
import moduleStyles from "./app/Movie.module.css";
// Consume the CSS Modules export so Vite retains its stylesheet for SSR too.
document.getElementById("root")!.dataset.cssModule = moduleStyles.header;
document.addEventListener(
  "keydown",
  () => {
    document.documentElement.dataset.input = "keyboard";
  },
  { capture: true },
);
document.addEventListener(
  "pointerdown",
  () => {
    document.documentElement.dataset.input = "pointer";
  },
  { capture: true },
);
const bootstrap = JSON.parse(
  document.getElementById("bootstrap")?.textContent ?? "{}",
) as { seed?: Seed; notFound?: boolean };
hydrateRoot(
  document.getElementById("root")!,
  <BrowserRouter>
    <App {...bootstrap} />
  </BrowserRouter>,
);
// Retire the former offline worker; it must not intercept content API writes/reads.
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then(async (registrations) => {
      await Promise.all(
        registrations
          .filter((r) => r.scope.startsWith(location.origin + "/"))
          .map((r) => r.unregister()),
      );
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("daily-movie"))
          .map((k) => caches.delete(k)),
      );
    })
    .catch(() => {
      /* Offline/cache cleanup is best effort, never block the page. */
    });
}
