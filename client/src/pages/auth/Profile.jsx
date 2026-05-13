import { useState, useEffect, useRef } from 'react';
import { getMe, updateProfile } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Profile.module.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ERROR_FIELD_MAP = {
  INVALID_NAME: 'name',
  INVALID_BIO: 'bio',
  INVALID_PASSWORD: 'password',
  INVALID_FILE: 'profile_image',
  INVALID_PROFILE_IMAGE: 'profile_image',
};

export default function Profile() {
  const { updateUser, logout } = useAuth();

  const [originalUser, setOriginalUser] = useState(null);
  const [fields, setFields] = useState({ name: '', bio: '', password: '' });
  const [profileFile, setProfileFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const fileInputRef = useRef(null);

  // 현재 프로필 로드
  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);

    getMe()
      .then((res) => {
        if (cancelled) return;
        const user = res.data?.data?.user;
        setOriginalUser(user);
        setFields({
          name: user.name || '',
          bio: user.bio || '',
          password: '',
        });
      })
      .catch(() => {
        if (!cancelled) setGlobalError('프로필을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => { cancelled = true; };
  }, []);

  // 새로 선택한 blob URL 해제
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setFieldErrors((prev) => ({ ...prev, profile_image: '파일 크기는 5MB 이하여야 합니다.' }));
      setProfileFile(null);
      setPreviewUrl(null);
      e.target.value = '';
      return;
    }

    // blob URL 해제는 useEffect cleanup에서 일원화
    setProfileFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    if (fieldErrors.profile_image) {
      setFieldErrors((prev) => ({ ...prev, profile_image: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setSuccessMsg('');
    setFieldErrors({});
    setIsLoading(true);

    const formData = new FormData();

    // 변경된 필드만 전송 (서버 검증에 맡김 — 빈 문자열도 전송하여 400 수신 가능)
    if (fields.name !== originalUser?.name) {
      formData.append('name', fields.name.trim());
    }
    // bio는 빈 문자열로 지울 수 있어야 하므로 항상 포함 (값이 변경된 경우)
    if (fields.bio !== (originalUser?.bio || '')) {
      formData.append('bio', fields.bio);
    }
    if (fields.password.trim()) {
      formData.append('password', fields.password.trim());
    }
    if (profileFile) {
      formData.append('profile_image', profileFile);
    }

    // 변경 사항이 없으면 제출 안 함
    let hasChanges = false;
    // eslint-disable-next-line no-unused-vars
    for (const _entry of formData.entries()) { hasChanges = true; break; }
    if (!hasChanges) {
      setGlobalError('변경된 내용이 없습니다.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await updateProfile(formData);
      const { message, user } = res.data?.data || {};

      // Context와 로컬 상태 동기화
      updateUser(user);
      setOriginalUser((prev) => ({ ...prev, ...user }));

      // 비밀번호 필드 초기화
      setFields((prev) => ({ ...prev, password: '' }));
      setProfileFile(null);
      // 새 이미지로 서버에서 받은 값 사용하므로 preview 해제
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      setSuccessMsg(message || '프로필이 수정되었습니다.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      const error = err.response?.data?.error || {};
      const { code, message, errors } = error;

      if (code === 'INVALID_INPUT' && Array.isArray(errors)) {
        const mapped = {};
        errors.forEach(({ field, message: msg }) => { mapped[field] = msg; });
        setFieldErrors(mapped);
      } else if (ERROR_FIELD_MAP[code]) {
        setFieldErrors({ [ERROR_FIELD_MAP[code]]: message });
      } else {
        setGlobalError(message || '프로필 수정 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  // 표시할 이미지: 새로 선택한 미리보기 > 서버 프로필 이미지
  const displayImageSrc = previewUrl || (originalUser?.profile_image || null);

  if (isFetching) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.loadingWrap}>
            <div className={`${styles.skeleton} ${styles.skeletonShort}`} />
            <div className={`${styles.skeleton} ${styles.skeletonMedium}`} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={`${styles.skeleton} ${styles.skeletonLong}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>프로필 수정</h1>
        {originalUser && (
          <p className={styles.handleBadge}>@{originalUser.handle}</p>
        )}

        {globalError && <p className={styles.globalError} role="alert">{globalError}</p>}
        {successMsg && <p className={styles.successMsg} role="alert">{successMsg}</p>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* 프로필 이미지 */}
          <div className={styles.fieldGroup}>
            <span className={styles.label}>프로필 사진</span>
            <div className={styles.imageArea}>
              <div className={styles.previewWrap}>
                {displayImageSrc ? (
                  <img src={displayImageSrc} alt="프로필" className={styles.previewImg} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
                      <circle cx="24" cy="19" r="8" fill="#fff" />
                      <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
                    </svg>
                  </div>
                )}
              </div>
              <div className={styles.imageActions}>
                <label className={styles.fileLabel} htmlFor="profile_image_edit">
                  {profileFile ? '다른 사진 선택' : '사진 변경'}
                </label>
                <input
                  id="profile_image_edit"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className={styles.fileInput}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <span className={styles.fileHint}>JPG, PNG, WebP · 최대 5MB</span>
                {fieldErrors.profile_image && (
                  <span id="profile-profile_image-error" className={styles.fieldError} role="alert">
                    {fieldErrors.profile_image}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 이름 */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="name">이름</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="표시될 이름"
              value={fields.name}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
              aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
            />
            {fieldErrors.name && (
              <span id="profile-name-error" className={styles.fieldError} role="alert">
                {fieldErrors.name}
              </span>
            )}
          </div>

          {/* bio */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="bio">
              소개 <span className={styles.labelHint}>(선택)</span>
            </label>
            <textarea
              id="bio"
              name="bio"
              placeholder="자신을 소개해보세요"
              value={fields.bio}
              onChange={handleChange}
              className={`${styles.textarea} ${fieldErrors.bio ? styles.inputError : ''}`}
              aria-describedby={fieldErrors.bio ? 'profile-bio-error' : undefined}
            />
            {fieldErrors.bio && (
              <span id="profile-bio-error" className={styles.fieldError} role="alert">
                {fieldErrors.bio}
              </span>
            )}
          </div>

          {/* 비밀번호 변경 */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">
              새 비밀번호 <span className={styles.labelHint}>(변경 시에만 입력)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="영문+숫자+특수문자 포함 8자 이상"
              value={fields.password}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              aria-describedby={fieldErrors.password ? 'profile-password-error' : undefined}
            />
            {fieldErrors.password && (
              <span id="profile-password-error" className={styles.fieldError} role="alert">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.submitBtn} disabled={isLoading}>
              {isLoading ? '처리 중...' : '저장'}
            </button>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
              disabled={isLoading}
            >
              로그아웃
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
