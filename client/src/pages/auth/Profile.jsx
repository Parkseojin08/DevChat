import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getMe, updateProfile, deleteAccount } from '../../api/auth';
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

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function Profile() {
  const { updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [originalUser, setOriginalUser] = useState(null);
  const [fields, setFields] = useState({ name: '', bio: '', password: '' });
  const [profileFile, setProfileFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // 회원 탈퇴 모달 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

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

    if (fields.name !== originalUser?.name) {
      formData.append('name', fields.name.trim());
    }
    if (fields.bio !== (originalUser?.bio || '')) {
      formData.append('bio', fields.bio);
    }
    if (fields.password.trim()) {
      formData.append('password', fields.password.trim());
    }
    if (profileFile) {
      formData.append('profile_image', profileFile);
    }

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

      updateUser(user);
      setOriginalUser((prev) => ({ ...prev, ...user }));

      setFields((prev) => ({ ...prev, password: '' }));
      setProfileFile(null);
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

  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (!deletePassword.trim()) {
      setDeleteError('비밀번호를 입력해주세요.');
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      updateUser(null);
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error?.message || '회원 탈퇴 중 오류가 발생했습니다.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = () => {
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeletePassword('');
    setDeleteError('');
  };

  const displayImageSrc = previewUrl || (originalUser?.profile_image || null);

  if (isFetching) {
    return (
      <div className={styles.page}>
        <div className={styles.wrapper}>
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
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <Link to="/" className={styles.homeBtn} aria-label="홈으로 돌아가기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          홈으로
        </Link>
        <div className={styles.card}>
          {/* 프로필 히어로 (이미지 + 이름) */}
          <div className={styles.profileHero}>
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
              <label className={styles.avatarEditBtn} htmlFor="profile_image_edit" aria-label="프로필 사진 변경">
                사진 변경
              </label>
              <input
                id="profile_image_edit"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.fileInput}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
            <div className={styles.profileHeroInfo}>
              <p className={styles.profileName}>{originalUser?.name}</p>
              {originalUser && <p className={styles.handleBadge}>@{originalUser.handle}</p>}
              <p className={styles.imageHint}>JPG, PNG, WebP · 최대 5MB</p>
              {fieldErrors.profile_image && (
                <span className={styles.imageError} role="alert">{fieldErrors.profile_image}</span>
              )}
            </div>
          </div>

          {globalError && (
            <div className={styles.globalError} role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{globalError}</span>
            </div>
          )}
          {successMsg && (
            <div className={styles.successMsg} role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="영문+숫자+특수문자 포함 8자 이상"
                  value={fields.password}
                  onChange={handleChange}
                  className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                  aria-describedby={fieldErrors.password ? 'profile-password-error' : undefined}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
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

          {/* 위험 영역 — 회원 탈퇴 */}
          <div className={styles.dangerZone}>
            <p className={styles.dangerTitle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              계정 삭제
            </p>
            <p className={styles.dangerDesc}>
              계정을 삭제하면 게시글, 친구 관계, 메시지가 모두 영구 삭제되며 복구할 수 없습니다.
            </p>
            <button
              type="button"
              className={styles.deleteAccountBtn}
              onClick={openDeleteModal}
              disabled={isLoading}
            >
              회원 탈퇴
            </button>
          </div>
        </div>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showDeleteModal && (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <p id="delete-account-title" className={styles.modalTitle}>회원 탈퇴</p>
            <p className={styles.modalDesc}>
              본인 확인을 위해 비밀번호를 입력해주세요. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className={styles.passwordWrap}>
              <input
                type={showDeletePassword ? 'text' : 'password'}
                className={styles.input}
                placeholder="현재 비밀번호"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  if (deleteError) setDeleteError('');
                }}
                autoComplete="current-password"
                autoFocus
                disabled={deleting}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowDeletePassword((v) => !v)}
                aria-label={showDeletePassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                tabIndex={-1}
              >
                <EyeIcon open={showDeletePassword} />
              </button>
            </div>
            {deleteError && (
              <p className={styles.fieldError} role="alert" style={{ marginTop: 8 }}>
                {deleteError}
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword.trim()}
              >
                {deleting ? '처리 중...' : '탈퇴'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
