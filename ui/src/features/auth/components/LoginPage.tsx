import styles from "./LoginPage.module.css";

const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID as string;

export function LoginPage() {
  const redirectUri = `${window.location.origin}/oauth/callback`;
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.logo}>Price Watch</h1>
        <p className={styles.tagline}>가격 추적 및 알림 서비스</p>
        <a href={kakaoAuthUrl} className={styles.kakaoBtn}>
          <svg className={styles.kakaoIcon} viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.18 4.6 6.56-.2.72-.72 2.6-.82 3-.14.52.18.52.38.38.16-.1 2.46-1.68 3.46-2.36.46.06.92.1 1.38.1 5.52 0 10-3.48 10-7.68S17.52 3 12 3z"
            />
          </svg>
          카카오 로그인
        </a>
      </div>
    </div>
  );
}
