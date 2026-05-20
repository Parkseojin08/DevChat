const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        throw new Error('[mailer] SMTP_USER, SMTP_PASS 환경 변수가 설정되지 않았습니다.');
    }

    cachedTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass }
    });

    return cachedTransporter;
}

/**
 * 이메일 인증 코드 발송.
 *
 * @param {object} params
 * @param {string} params.to       - 수신자 이메일
 * @param {string} params.code     - 6자리 코드
 * @param {number} params.ttlMinutes - 유효 시간(분), 메일 본문에 명시
 */
exports.sendVerificationCode = async ({ to, code, ttlMinutes }) => {
    const transporter = getTransporter();

    const fromAddr = process.env.SMTP_USER;

    const subject = '[DevChat] 회원가입 이메일 인증 코드';

    // HTML은 안전을 위해 외부 입력을 포함하지 않는다 (code는 6자리 숫자만).
    const html = `
<!DOCTYPE html>
<html lang="ko">
<body style="margin:0;padding:32px 16px;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#222;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#1877f2;">DevChat 이메일 인증</h1>
    <p style="margin:0 0 20px 0;font-size:14px;color:#65676b;line-height:1.5;">
      회원가입을 완료하려면 아래 인증 코드를 입력해주세요.
    </p>
    <div style="margin:24px 0;padding:20px;background:#f7f8fa;border-radius:8px;text-align:center;">
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1877f2;font-family:'Courier New',monospace;">
        ${code}
      </div>
    </div>
    <p style="margin:0 0 8px 0;font-size:13px;color:#65676b;line-height:1.5;">
      이 코드는 <strong>${ttlMinutes}분간</strong> 유효합니다.
    </p>
    <p style="margin:0;font-size:12px;color:#8a8d91;line-height:1.5;">
      본인이 요청하지 않은 경우 이 메일을 무시해주세요.
    </p>
  </div>
</body>
</html>`.trim();

    const text = `[DevChat] 이메일 인증 코드: ${code}\n\n이 코드는 ${ttlMinutes}분간 유효합니다.\n본인이 요청하지 않은 경우 이 메일을 무시해주세요.`;

    await transporter.sendMail({
        from: `"DevChat" <${fromAddr}>`,
        to,
        subject,
        text,
        html
    });
};
