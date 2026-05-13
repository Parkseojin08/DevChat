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

export default function Signup() {
  const navigate = useNavigate();

  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [profileFile, setProfileFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        // Zod 배열 형식: [{ field, message }, ...]
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
        <h1 className={styles.title}>DevChat</h1>
        <p className={styles.subtitle}>새 계정을 만들어보세요</p>

        {globalError && <p className={styles.globalError} role="alert">{globalError}</p>}
        {successMsg && <p className={styles.successMsg} role="alert">{successMsg}</p>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* 프로필 이미지 */}
          <div className={styles.fieldGroup}>
            <span className={styles.label}>프로필 사진 (선택)</span>
            <div className={styles.fileArea}>
              <div className={styles.previewWrap}>
                {previewUrl ? (
                  <img src={previewUrl} alt="프로필 미리보기" className={styles.previewImg} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
                      <circle cx="24" cy="19" r="8" fill="#fff" />
                      <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
                    </svg>
                  </div>
                )}
              </div>
              <label className={styles.fileLabel} htmlFor="profile_image_input">
                {previewUrl ? '사진 변경' : '사진 선택'}
              </label>
              <input
                id="profile_image_input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.fileInput}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <span className={styles.fileHint}>JPG, PNG, WebP · 최대 5MB</span>
              {fieldErrors.profile_image && (
                <span id="signup-profile_image-error" className={styles.fieldError} role="alert">
                  {fieldErrors.profile_image}
                </span>
              )}
            </div>
          </div>

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
            />
            {fieldErrors.handle && (
              <span id="signup-handle-error" className={styles.fieldError} role="alert">
                {fieldErrors.handle}
              </span>
            )}
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

          {/* password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="영문+숫자+특수문자 포함 8자 이상"
              value={fields.password}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
            />
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
            {isLoading ? '처리 중...' : '회원가입'}
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
