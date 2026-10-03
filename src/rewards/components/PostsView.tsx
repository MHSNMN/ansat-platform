import React, { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Send,
  Heart,
  Trash2,
  CornerDownLeft,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { PostItem, CommentItem } from "../types";

interface PostsViewProps {
  currentUserId: string;
  canModerate: boolean;
}

export const PostsView: React.FC<PostsViewProps> = ({
  currentUserId,
  canModerate,
}) => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [newPostText, setNewPostText] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(
    null,
  );
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentItem[]>>(
    {},
  );
  const [commentInputMap, setCommentInputMap] = useState<
    Record<string, string>
  >({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(
    null,
  );

  const fetchPosts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErrorMessage("");
    try {
      const res = await apiFetch("/api/rewards/community");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر تحميل المنشورات");
      }
      setPosts(data.posts || []);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "حدث خطأ أثناء تحميل المنشورات",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newPostText.trim();
    if (text.length < 2) return;

    setPublishing(true);
    setErrorMessage("");
    try {
      const res = await apiFetch("/api/rewards/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر نشر المنشور");
      }
      setNewPostText("");
      await fetchPosts(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "تعذر نشر المنشور");
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const res = await apiFetch(`/api/rewards/posts/${postId}/like`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likedByMe: data.liked,
                  likes: data.likesCount,
                }
              : p,
          ),
        );
      }
    } catch {
      // Silent error
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا المنشور؟")) return;
    try {
      const res = await apiFetch(`/api/rewards/posts/${postId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      // Silent error
    }
  };

  const handleToggleComments = async (postId: string) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }
    setOpenCommentsPostId(postId);

    // Fetch comments if not already cached
    if (!commentsMap[postId]) {
      try {
        const res = await apiFetch(`/api/rewards/posts/${postId}/comments`);
        const data = await res.json();
        if (res.ok && data.success) {
          setCommentsMap((prev) => ({
            ...prev,
            [postId]: data.comments || [],
          }));
        }
      } catch {
        // Silent error
      }
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentInputMap[postId] || "").trim();
    if (!text) return;

    setSubmittingComment(postId);
    try {
      const res = await apiFetch(`/api/rewards/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCommentInputMap((prev) => ({ ...prev, [postId]: "" }));
        // Refresh comments for this post
        const refreshedRes = await apiFetch(
          `/api/rewards/posts/${postId}/comments`,
        );
        const refreshedData = await refreshedRes.json();
        if (refreshedRes.ok && refreshedData.success) {
          setCommentsMap((prev) => ({
            ...prev,
            [postId]: refreshedData.comments || [],
          }));
        }
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
              : p,
          ),
        );
      }
    } catch {
      // Silent error
    } finally {
      setSubmittingComment(null);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat("ar-IQ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="rew-posts-layout" dir="rtl">
      {/* Post Composer Card */}
      <div className="rew-card rew-composer-card">
        <div className="rew-card-head">
          <div className="rew-card-title-group">
            <MessageCircle size={18} />
            <h4>شارك الفريق إنجازك أو فكرة ملهمة</h4>
          </div>
          <span className="rew-card-tag">مجتمع إنصات</span>
        </div>

        <form onSubmit={handlePublishPost}>
          <textarea
            className="rew-composer-textarea"
            placeholder="ماذا أنجزت اليوم؟ شارك الفريق نصيحة صوتية، شكراً لزميل، أو إنجازاً حققته..."
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            maxLength={1200}
            rows={3}
            required
          />

          {errorMessage && (
            <div className="rew-composer-error">{errorMessage}</div>
          )}

          <div className="rew-composer-footer">
            <span className="rew-char-counter">
              {newPostText.length} / 1200
            </span>
            <button
              type="submit"
              className="rew-btn-primary"
              disabled={publishing || newPostText.trim().length < 2}
            >
              <Send size={15} />
              <span>{publishing ? "جارٍ النشر..." : "نشر التحديث"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Posts Feed */}
      <div className="rew-feed-section">
        <div className="rew-feed-head">
          <div className="rew-feed-title">
            <Sparkles size={17} />
            <h3>تحديثات الزملاء</h3>
          </div>
          <button
            type="button"
            className="rew-refresh-mini-btn"
            onClick={() => void fetchPosts(true)}
            title="تحديث المنشورات"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>تحديث</span>
          </button>
        </div>

        {posts.length > 0 ? (
          <div className="rew-posts-list">
            {posts.map((post) => {
              const isAuthor = post.authorUid === currentUserId;
              const canDelete = isAuthor || canModerate;
              const isCommentsOpen = openCommentsPostId === post.id;
              const comments = commentsMap[post.id] || [];

              return (
                <article key={post.id} className="rew-card rew-post-card">
                  <div className="rew-post-top">
                    <div className="rew-post-author-box">
                      <div className="rew-author-avatar">
                        {(post.authorName || "ع").charAt(0)}
                      </div>
                      <div className="rew-author-meta">
                        <strong>{post.authorName || "عضو إنصات"}</strong>
                        <small>{formatDate(post.createdAt)}</small>
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        className="rew-post-delete-btn"
                        onClick={() => handleDeletePost(post.id)}
                        title="حذف المنشور"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div className="rew-post-body">
                    <p>{post.text}</p>
                  </div>

                  <div className="rew-post-actions">
                    <button
                      type="button"
                      className={`rew-post-action-btn ${post.likedByMe ? "liked" : ""}`}
                      onClick={() => handleToggleLike(post.id)}
                    >
                      <Heart
                        size={16}
                        className={post.likedByMe ? "fill-red" : ""}
                      />
                      <span>{post.likes || 0}</span>
                    </button>

                    <button
                      type="button"
                      className={`rew-post-action-btn ${isCommentsOpen ? "active" : ""}`}
                      onClick={() => handleToggleComments(post.id)}
                    >
                      <MessageCircle size={16} />
                      <span>
                        {post.commentsCount || comments.length || 0} تعليقات
                      </span>
                    </button>
                  </div>

                  {/* Collapsible Comments Section */}
                  {isCommentsOpen && (
                    <div className="rew-comments-thread">
                      <div className="rew-comments-list">
                        {comments.length > 0 ? (
                          comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="rew-comment-bubble"
                            >
                              <div className="rew-comment-head">
                                <strong>{comment.authorName}</strong>
                                <small>{formatDate(comment.createdAt)}</small>
                              </div>
                              <p>{comment.text}</p>
                            </div>
                          ))
                        ) : (
                          <p className="rew-no-comments">
                            كن أول من يعلق على هذا التحديث!
                          </p>
                        )}
                      </div>

                      <div className="rew-comment-input-row">
                        <input
                          type="text"
                          placeholder="اكتب رداً أو كلمة تقدير..."
                          value={commentInputMap[post.id] || ""}
                          onChange={(e) =>
                            setCommentInputMap((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void handleAddComment(post.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="rew-comment-send-btn"
                          disabled={
                            submittingComment === post.id ||
                            !(commentInputMap[post.id] || "").trim()
                          }
                          onClick={() => handleAddComment(post.id)}
                        >
                          <CornerDownLeft size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rew-card rew-empty-feed">
            <MessageCircle size={32} />
            <h4>لا توجد منشورات بعد</h4>
            <p>كن المبادر وابدأ أول محادثة في مجتمع إنصات أعلاه!</p>
          </div>
        )}
      </div>
    </div>
  );
};
