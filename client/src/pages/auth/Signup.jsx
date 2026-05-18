import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../../api/auth';
import styles from './Signup.module.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const INITIAL_FIELDS = {
  handle: '',
  email: '',
  name: '',
  password: '',
  birth_date: '',
};

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className={styles.spinnerIcon} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
    </svg>
  );
}

export default function Signup() {
  const navigate = useNavigate();

  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [profileFile, setProfileFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fileInputRef = useRef(null);

  // blob URL 메모리 해제
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    // 입력 시 해당 필드 에러 초기화
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
    formData.append('handle', fields.handle);
    formData.append('email', fields.email);
    formData.append('name', fields.name);
    formData.append('password', fields.password);
    formData.append('birth_date', fields.birth_date);
    if (profileFile) {
      formData.append('profile_image', profileFile);
    }

    try {
      const res = await signUp(formData);
      const message = res.data?.data?.message || '회원가입을 성공하였습니다.';
      setSuccessMsg(message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const error = err.response?.data?.error || {};
      const { code, message, errors } = error;

      if (code === 'INVALID_INPUT' && Array.isArray(errors)) {
        const mapped = {};
        errors.forEach(({ field, message: msg }) => {
          mapped[field] = msg;
        });
        setFieldErrors(mapped);
      } else if (code === 'HANDLE_TAKEN') {
        setFieldErrors({ handle: message });
      } else if (code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: message });
      } else if (code === 'INVALID_FILE') {
        setFieldErrors({ profile_image: message });
      } else {
        setGlobalError(message || '회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 40 40" fill="none" width="32" height="32">
              <rect width="40" height="40" rx="10" fill="#1877f2" />
              <path d="M22 20h4l1-4h-5v-2c0-1.1.5-2 2-2h3V8h-3c-3.9 0-6 2.5-6 6v2h-3v4h3v10h4V20z" fill="#fff" />
            </svg>
          </div>
          <h1 className={styles.title}>DevChat</h1>
        </div>
        <p className={styles.subtitle}>새 계정을 만들어보세요</p>

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
          {/* 프로필 이미지 */}
          <div className={styles.avatarSection}>
            <div className={styles.previewWrap}>
              {previewUrl ? (
                <img src={previewUrl} alt="프로필 미리보기" className={styles.previewImg} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
                    <circle cx="24" cy="19" r="8" fill="#fff" />
                    <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
                  </svg>
                </div>
              )}
              <label className={styles.avatarEditBtn} htmlFor="profile_image_input" aria-label="프로필 사진 선택">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </label>
              <input
                id="profile_image_input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.fileInput}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
            <div className={styles.avatarMeta}>
              <p className={styles.avatarLabel}>프로필 사진 <span className={styles.optionalBadge}>선택</span></p>
              <p className={styles.fileHint}>JPG, PNG, WebP · 최대 5MB</p>
              {fieldErrors.profile_image && (
                <span className={styles.fieldError} role="alert">{fieldErrors.profile_image}</span>
              )}
            </div>
          </div>

          {/* 2열 그리드 필드 (데스크탑) */}
          <div className={styles.fieldRow}>
            {/* handle */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="handle">아이디 (handle)</label>
              <input
                id="handle"
                name="handle"
                type="text"
                autoComplete="username"
                placeholder="영문/숫자/_ 3~20자"
                value={fields.handle}
                onChange={handleChange}
                className={`${styles.input} ${fieldErrors.handle ? styles.inputError : ''}`}
                aria-describedby={fieldErrors.handle ? 'signup-handle-error' : undefined}
                autoFocus
              />
              {fieldErrors.handle && (
                <span id="signup-handle-error" className={styles.fieldError} role="alert">
                  {fieldErrors.handle}
                </span>
              )}
            </div>

            {/* name */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="name">이름</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="표시될 이름 (1~50자)"
                value={fields.name}
                onChange={handleChange}
                className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
                aria-describedby={fieldErrors.name ? 'signup-name-error' : undefined}
              />
              {fieldErrors.name && (
                <span id="signup-name-error" className={styles.fieldError} role="alert">
                  {fieldErrors.name}
                </span>
              )}
            </div>
          </div>

          {/* email */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="example@email.com"
              value={fields.email}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
              aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
            />
            {fieldErrors.email && (
              <span id="signup-email-error" className={styles.fieldError} role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">비밀번호</label>
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
                aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
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
              <span id="signup-password-error" className={styles.fieldError} role="alert">
                {fieldErrors.password}
              </span>
            )}
          </div>

          {/* birth_date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="birth_date">생년월일</label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              value={fields.birth_date}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.birth_date ? styles.inputError : ''}`}
              aria-describedby={fieldErrors.birth_date ? 'signup-birth_date-error' : undefined}
            />
            {fieldErrors.birth_date && (
              <span id="signup-birth_date-error" className={styles.fieldError} role="alert">
                {fieldErrors.birth_date}
              </span>
            )}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? (
              <><Spinner /> 처리 중...</>
            ) : '회원가입'}
          </button>
        </form>

        <p className={styles.divider}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className={styles.link}>로그인</Link>
        </p>
      </div>
    </div>
  );
}
