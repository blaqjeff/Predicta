/**
 * OTP email delivery. Uses Resend (free tier) when RESEND_API_KEY is set,
 * otherwise logs the code to the server console for local development.
 */

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    "Predicta <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(
      `\n[email] (dev) OTP for ${email}: ${code}  (set RESEND_API_KEY to send real emails)\n`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Predicta login code",
      text: `Your Predicta login code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Predicta login code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to send email: ${res.status} ${body}`);
  }
}
