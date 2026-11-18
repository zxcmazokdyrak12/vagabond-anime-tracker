import { useState } from "react";
import { updateMe } from "../api";
import type { User } from "../types";
import { useT } from "../lib/i18n";
import InkArt from "./InkArt";

/** Переключатель «показывать мой путь всем» и ссылка на публичную страницу */
export default function ShareProfile({
  user,
  onUserChange,
}: {
  user: User;
  onUserChange: (u: User) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/u/${encodeURIComponent(user.username)}`;

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await updateMe({ is_public: !user.is_public });
      onUserChange({ ...user, ...res.data });
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // буфер обмена недоступен — ссылка всё равно видна и выделяется
    }
  };

  return (
    <section className="section share" aria-labelledby="share-head">
      <h2 className="section-head" id="share-head">
        <span className="brush" aria-hidden="true">
          公
        </span>
        {t("Share your path")}
      </h2>
      <div className="share__body">
        <InkArt name="otsu-musashi" className="share__art" />
        <div>
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(user.is_public)}
              disabled={busy}
              onChange={toggle}
            />
            {t(
              "Anyone with the link can see my scrolls and stats (notes stay private)",
            )}
          </label>
          {user.is_public && (
            <div className="share__link">
              <a href={url} target="_blank" rel="noreferrer">
                {url.replace(/^https?:\/\//, "")}
              </a>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={copy}
              >
                {copied ? t("Copied") : t("Copy link")}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
