"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";

import { isAdminEmail } from "@/lib/auth/policies";
import type { FirebaseClient } from "@/lib/firebase/client";
import { getFirebaseClient } from "@/lib/firebase/client";

export default function AdminLoginButton() {
  const [client, setClient] = useState<FirebaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setClient(getFirebaseClient());
    } catch (initError) {
      setError(initError instanceof Error ? initError.message : "Firebase 구성이 필요합니다.");
    }
  }, []);

  useEffect(() => {
    if (!client) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(client.auth, async (nextUser) => {
      if (nextUser && !isAdminEmail(nextUser.email)) {
        setError("허용되지 않은 관리자 계정입니다.");
        await signOut(client.auth);
        setUser(null);
        return;
      }

      setError(null);
      setUser(nextUser);
    });

    return () => unsubscribe();
  }, [client]);

  const handleLogin = async () => {
    if (!client || status === "working") {
      return;
    }

    setStatus("working");
    try {
      const credential = await signInWithPopup(client.auth, client.provider);
      if (!isAdminEmail(credential.user.email)) {
        setError("등록된 관리자 이메일로 로그인해 주세요.");
        await signOut(client.auth);
        return;
      }

      setError(null);
    } catch (authError) {
      console.error("관리자 로그인 실패", authError);
      setError("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setStatus("idle");
    }
  };

  const handleLogout = async () => {
    if (!client || status === "working") {
      return;
    }

    setStatus("working");
    try {
      await signOut(client.auth);
      setError(null);
    } catch (signOutError) {
      console.error("관리자 로그아웃 실패", signOutError);
      setError("로그아웃에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setStatus("idle");
    }
  };

  const isAdmin = Boolean(user && isAdminEmail(user.email));
  const buttonDisabled = !client || status === "working";

  return (
    <div className="flex flex-col items-start gap-1 text-xs text-white/60 sm:items-end">
      <button
        type="button"
        onClick={isAdmin ? handleLogout : handleLogin}
        disabled={buttonDisabled}
        className="rounded-full border border-white/20 px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isAdmin ? "관리자 로그아웃" : "관리자 로그인"}
      </button>
      {isAdmin ? (
        <span className="text-[0.65rem] text-white/50">{user?.email}</span>
      ) : null}
      {error ? <span className="text-[0.65rem] text-rose-200">{error}</span> : null}
    </div>
  );
}
