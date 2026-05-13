import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Home.module.css';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>DevChat</h1>
        <p className={styles.welcome}>
          안녕하세요, <strong>{user?.name || user?.handle}</strong>님!
        </p>

        <div className={styles.userInfo}>
          {user?.profile_image ? (
            <img
              src={user.profile_image}
              alt="프로필"
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarPlaceholder}>
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
                <circle cx="24" cy="19" r="8" fill="#fff" />
                <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
              </svg>
            </div>
          )}
          <div className={styles.userDetails}>
            <p className={styles.userName}>{user?.name}</p>
            <p className={styles.userHandle}>@{user?.handle}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <Link to="/me" className={styles.profileLink}>프로필 수정</Link>
          <Link to="/friends" className={styles.friendsLink}>친구 관리</Link>
          <button className={styles.logoutBtn} onClick={() => logout()}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
