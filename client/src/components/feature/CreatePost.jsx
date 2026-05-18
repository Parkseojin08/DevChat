import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createPost } from '../../api/feed';
import styles from './CreatePost.module.css';

const MAX_FILES = 5;

function AvatarSmall({ src, name }) {
  if (src) {
    return <img src={src} alt={name} className={styles.avatar} />;
  }
  return (
    <div className={styles.avatarPlaceholder}>
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
        <circle cx="24" cy="19" r="8" fill="#fff" />
        <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
      </svg>
    </div>
  );
}

export default function CreatePost({ onPostCreated }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    const combined = [...files, ...selected];
    const limited = combined.slice(0, MAX_FILES);

    setFiles(limited);

    // 기존 preview URL 해제
    previews.forEach((url) => URL.revokeObjectURL(url));
    const newPreviews = limited.map((f) => URL.createObjectURL(f));
    setPreviews(newPreviews);

    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = '';
  };

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (trimmedContent) formData.append('content', trimmedContent);
      files.forEach((f) => formData.append('media', f));

      const res = await createPost(formData);
      const newPost = res.data.data.post;

      // 초기화
      previews.forEach((url) => URL.revokeObjectURL(url));
      setContent('');
      setFiles([]);
      setPreviews([]);

      onPostCreated(newPost);
    } catch (err) {
      setError(err.response?.data?.error?.message || '게시글 작성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = content.trim().length > 0 && !loading;

  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <AvatarSmall src={user?.profile_image} name={user?.name} />
        <textarea
          className={styles.textarea}
          placeholder="무슨 생각을 하고 계신가요?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
      </div>

      {/* 파일 미리보기 */}
      {previews.length > 0 && (
        <div className={styles.previewGrid}>
          {previews.map((url, i) => (
            <div key={i} className={styles.previewItem}>
              <img src={url} alt={`첨부 ${i + 1}`} className={styles.previewImg} />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeFile(i)}
                aria-label="파일 제거"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 에러 */}
      {error && <p className={styles.error}>{error}</p>}

      {/* 하단 액션 바 */}
      <div className={styles.bottomBar}>
        <div className={styles.leftActions}>
          <button
            type="button"
            className={styles.mediaBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES || loading}
            title={files.length >= MAX_FILES ? `최대 ${MAX_FILES}개까지 첨부 가능합니다` : '사진 첨부'}
          >
            <span className={styles.mediaBtnIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </span>
            <span>사진</span>
            {files.length > 0 && (
              <span className={styles.fileCount}>{files.length}/{MAX_FILES}</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
        </div>
        <button
          type="button"
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? '게시 중...' : '게시'}
        </button>
      </div>
    </div>
  );
}
