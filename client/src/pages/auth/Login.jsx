import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login as loginApi } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [fields, setFields] = useState({ email: '', password: '' });
  const [globalError, setGlobalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    if (globalError) setGlobalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setIsLoading(true);

    try {
      const res = await loginApi(fields);
      const user = res.data?.data?.user;
      login(user);
      navigate('/');
    } catch (err) {
      const error = err.response?.data?.error || {};
      const { message } = error;
      setGlobalError(message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>DevChat</h1>
        <p className={styles.subtitle}>계정에 로그인하세요</p>

        {globalError && <p className={styles.globalError} role="alert">{globalError}</p>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              value={fields.password}
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? '처리 중...' : '로그인'}
          </button>
        </form>

        <p className={styles.divider}>
          계정이 없으신가요?{' '}
          <Link to="/signup" className={styles.link}>회원가입</Link>
        </p>
      </div>
    </div>
  );
}
