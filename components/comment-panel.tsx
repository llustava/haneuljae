"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  addDoc,
  collection,
  getDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { FirebaseClient } from "@/lib/firebase/client";
import { getFirebaseClient } from "@/lib/firebase/client";
import {
  BLOCK_COLLECTION,
  formatBlockMessage,
  genericDomainRejectMessage,
  isAdminEmail,
  isEmailAllowed,
  shouldEnforceDomain,
} from "@/lib/auth/policies";

const formatTimestamp = (value?: Timestamp | null) => {
  if (!value) {
    return "방금";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value.toDate());
};

type CommentPanelProps = {
  slug: string;
  title: string;
};

type CommentEntry = {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  body: string;
  parentId: string | null;
  createdAt?: Timestamp | null;
  isDeleted: boolean;
};

type CommentThread = CommentEntry & {
  replies: CommentEntry[];
};

export default function CommentPanel({ slug, title }: CommentPanelProps) {
  const [client, setClient] = useState<FirebaseClient | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeReplyParent, setActiveReplyParent] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replySubmittingId, setReplySubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const blockUnsubscribeRef = useRef<(() => void) | null>(null);

  const isAdmin = isAdminEmail(user?.email);
  const userId = user?.uid ?? null;

  useEffect(() => {
    try {
      setClient(getFirebaseClient());
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Firebase 구성이 필요합니다."
      );
    }
  }, []);

  useEffect(() => {
    if (!client) {
      return undefined;
    }

    const cleanupBlockListener = () => {
      if (blockUnsubscribeRef.current) {
        blockUnsubscribeRef.current();
        blockUnsubscribeRef.current = null;
      }
    };

    const unsubscribe = onAuthStateChanged(client.auth, async (nextUser) => {
      cleanupBlockListener();

      if (!nextUser) {
        setUser(null);
        return;
      }

      if (shouldEnforceDomain && !isEmailAllowed(nextUser.email)) {
        setClientError(genericDomainRejectMessage);
        setUser(null);
        await signOut(client.auth);
        return;
      }

      const blockRef = doc(client.db, BLOCK_COLLECTION, nextUser.uid);
      const blockSnapshot = await getDoc(blockRef);
      if (blockSnapshot.exists()) {
        const blockData = blockSnapshot.data() as { reason?: string } | undefined;
        setClientError(formatBlockMessage(blockData?.reason));
        setUser(null);
        await signOut(client.auth);
        return;
      }

      blockUnsubscribeRef.current = onSnapshot(blockRef, (blockDoc) => {
        if (!blockDoc.exists()) {
          return;
        }
        const blockData = blockDoc.data() as { reason?: string } | undefined;
        setClientError(formatBlockMessage(blockData?.reason));
        signOut(client.auth);
      });

      setClientError(null);
      setUser(nextUser);
    });

    return () => {
      unsubscribe();
      cleanupBlockListener();
    };
  }, [client]);

  useEffect(() => {
    if (!client || !userId) {
      setComments([]);
      return undefined;
    }

    const commentsQuery = query(
      collection(client.db, "logoComments"),
      where("slug", "==", slug),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const nextEntries: CommentEntry[] = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as {
          displayName?: string;
          body?: string;
          parentId?: string | null;
          userId?: string;
          email?: string | null;
          createdAt?: Timestamp | null;
          isDeleted?: boolean;
        };

        return {
          id: docSnapshot.id,
          userId: data.userId ?? "",
          displayName: data.displayName ?? "익명",
          email: data.email ?? null,
          body: data.body ?? "",
          parentId: data.parentId ?? null,
          createdAt: data.createdAt ?? null,
          isDeleted: Boolean(data.isDeleted),
        };
      });

      setComments(nextEntries);
    });

    return unsubscribe;
  }, [client, slug, userId]);

  const threads = useMemo<CommentThread[]>(() => {
    const topLevel = comments.filter((entry) => !entry.parentId);

    return topLevel.map((entry) => ({
      ...entry,
      replies: comments.filter((reply) => reply.parentId === entry.id),
    }));
  }, [comments]);

  const commentCount = comments.length;

  const handleCommentSubmit = async () => {
    if (!client || !user) {
      return;
    }

    const trimmed = commentBody.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(client.db, "logoComments"), {
        slug,
        userId: user.uid,
        displayName: user.displayName ?? user.email ?? "익명",
        email: user.email ?? null,
        body: trimmed,
        parentId: null,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      setCommentBody("");
      setClientError(null);
    } catch (error) {
      console.error("댓글 저장 실패", error);
      setClientError("댓글 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentId: string) => {
    if (!client || !user) {
      return;
    }

    const parentEntry = comments.find((entry) => entry.id === parentId);
    if (!parentEntry || parentEntry.parentId) {
      setClientError("대댓글은 최상위 댓글에만 작성할 수 있습니다.");
      return;
    }

    if (parentEntry.isDeleted) {
      setClientError("삭제된 댓글에는 대댓글을 달 수 없습니다.");
      return;
    }

    const trimmed = replyDrafts[parentId]?.trim();
    if (!trimmed) {
      return;
    }

    setReplySubmittingId(parentId);

    try {
      await addDoc(collection(client.db, "logoComments"), {
        slug,
        userId: user.uid,
        displayName: user.displayName ?? user.email ?? "익명",
        email: user.email ?? null,
        body: trimmed,
        parentId,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
      setActiveReplyParent(null);
      setClientError(null);
    } catch (error) {
      console.error("대댓글 저장 실패", error);
      setClientError("대댓글 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setReplySubmittingId(null);
    }
  };

  const handleDelete = async (comment: CommentEntry) => {
    if (!client || !user) {
      return;
    }

    if ((!isAdmin && comment.userId !== user.uid) || comment.isDeleted) {
      return;
    }

    setDeletingId(comment.id);

    try {
      await updateDoc(doc(client.db, "logoComments", comment.id), {
        isDeleted: true,
        body: "",
        deletedAt: serverTimestamp(),
      });
      setClientError(null);
    } catch (error) {
      console.error("댓글 삭제 실패", error);
      setClientError("댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBlockUser = async (entry: CommentEntry) => {
    if (!client || !isAdmin || !entry.userId) {
      return;
    }

    const reasonInput =
      typeof window === "undefined"
        ? "관리자 차단"
        : window.prompt("차단 사유를 입력하세요", "커뮤니티 정책 위반") ?? "";

    setBlockingUserId(entry.userId);

    try {
      await setDoc(doc(client.db, BLOCK_COLLECTION, entry.userId), {
        userId: entry.userId,
        displayName: entry.displayName,
        email: entry.email ?? null,
        reason: reasonInput.trim() || "관리자 차단",
        blockedBy: user?.uid ?? "admin",
        blockedByEmail: user?.email ?? null,
        createdAt: serverTimestamp(),
      });
      if (typeof window !== "undefined") {
        window.alert(`${entry.displayName} 계정을 차단했습니다.`);
      }
      setClientError(null);
    } catch (error) {
      console.error("계정 차단 실패", error);
      setClientError("계정 차단 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBlockingUserId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-white shadow-[0_25px_80px_rgba(15,23,42,0.55)] sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">comments</p>
          <h3 className="text-2xl font-semibold">{title} 댓글</h3>
          <p className="text-sm text-white/60">댓글 {commentCount}개</p>
        </div>
        
      </header>

      {clientError ? (
        <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {clientError}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        <textarea
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          disabled={!user || isSubmitting}
          placeholder={user ? "느낀 점이나 질문을 남겨주세요." : "로그인 후 댓글을 확인 및 작성할 수 있습니다."}
          className="h-32 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCommentSubmit}
          disabled={!user || isSubmitting}
          className="w-full rounded-2xl bg-white/90 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "등록 중..." : "댓글 등록"}
        </button>
      </div>

      <ul className="mt-8 space-y-4">
        {threads.length ? (
          threads.map((thread, threadIndex) => (
            <li key={thread.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                      댓글 {threadIndex + 1}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        thread.isDeleted ? "text-white/40" : "text-white"
                      }`}
                    >
                      {thread.displayName}
                    </p>
                  </div>
                  <p className="text-xs text-white/50">{formatTimestamp(thread.createdAt)}</p>
                </div>
                <p
                  className={`whitespace-pre-line text-sm ${
                    thread.isDeleted ? "text-white/40" : "text-white/80"
                  }`}
                >
                  {thread.isDeleted ? "(삭제된 댓글입니다)" : thread.body}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
                {!thread.isDeleted ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveReplyParent((current) => (current === thread.id ? null : thread.id))
                    }
                    className={`rounded-full border px-3 py-1 transition ${
                      activeReplyParent === thread.id
                        ? "border-sky-300/80 text-white"
                        : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    대댓글 달기
                  </button>
                ) : (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-white/40">
                    대댓글 불가
                  </span>
                )}
                {(isAdmin || user?.uid === thread.userId) && !thread.isDeleted ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(thread)}
                    disabled={deletingId === thread.id}
                    className="rounded-full border border-white/20 px-3 py-1 text-white/70 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === thread.id ? "삭제 중..." : "삭제"}
                  </button>
                ) : null}
                {isAdmin && !thread.isDeleted && thread.userId !== user?.uid ? (
                  <button
                    type="button"
                    onClick={() => handleBlockUser(thread)}
                    disabled={blockingUserId === thread.userId}
                    className="rounded-full border border-rose-400/40 px-3 py-1 text-white/80 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {blockingUserId === thread.userId ? "차단 중..." : "계정 차단"}
                  </button>
                ) : null}
                <span className="text-white/30">·</span>
                <span>최대 1단계 대댓글만 허용됩니다.</span>
              </div>

              {activeReplyParent === thread.id && !thread.isDeleted ? (
                <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                  <textarea
                    value={replyDrafts[thread.id] ?? ""}
                    onChange={(event) =>
                      setReplyDrafts((prev) => ({ ...prev, [thread.id]: event.target.value }))
                    }
                    disabled={!user || replySubmittingId === thread.id}
                    placeholder="대댓글 내용을 입력하세요"
                    className="h-24 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleReplySubmit(thread.id)}
                    disabled={!user || replySubmittingId === thread.id}
                    className="w-full rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replySubmittingId === thread.id ? "등록 중..." : "대댓글 등록"}
                  </button>
                </div>
              ) : null}

              {thread.replies.length ? (
                <ul className="mt-4 space-y-3 border-l border-white/10 pl-4">
                  {thread.replies.map((reply, replyIndex) => (
                    <li key={reply.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                          - 대댓글 {threadIndex + 1}.{replyIndex + 1}
                        </p>
                        <p className="text-xs text-white/50">{formatTimestamp(reply.createdAt)}</p>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p
                          className={`text-sm font-semibold ${
                            reply.isDeleted ? "text-white/40" : "text-white"
                          }`}
                        >
                          {reply.displayName}
                        </p>
                        {(isAdmin || user?.uid === reply.userId) && !reply.isDeleted ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(reply)}
                            disabled={deletingId === reply.id}
                            className="text-xs text-white/70 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === reply.id ? "삭제 중..." : "삭제"}
                          </button>
                        ) : null}
                        {isAdmin && !reply.isDeleted && reply.userId !== user?.uid ? (
                          <button
                            type="button"
                            onClick={() => handleBlockUser(reply)}
                            disabled={blockingUserId === reply.userId}
                            className="text-xs text-rose-200 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {blockingUserId === reply.userId ? "차단 중..." : "계정 차단"}
                          </button>
                        ) : null}
                      </div>
                      <p
                        className={`whitespace-pre-line text-sm ${
                          reply.isDeleted ? "text-white/40" : "text-white/80"
                        }`}
                      >
                        {reply.isDeleted ? "(삭제된 댓글입니다)" : reply.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))
        ) : (
          <li className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-center text-sm text-white/50">
            아직 댓글이 없거나 로그인하지 않으셨습니다. 
          </li>
        )}
      </ul>
    </section>
  );
}
