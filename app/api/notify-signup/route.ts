import { NextResponse } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "contact@alacle.org";
const EMAIL_FROM = process.env.NOTIFICATION_EMAIL_FROM ?? "Sage <onboarding@resend.dev>";

type SignupNotificationBody = {
  email?: string;
  name?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return NextResponse.json({ sent: false, reason: "RESEND_API_KEY missing" });
  }

  const body = (await request.json()) as SignupNotificationBody;
  const email = body.email?.trim();
  const name = body.name?.trim() || "Nom non renseigné";

  if (!email) {
    return NextResponse.json(
      { error: "L'email de l'utilisateur est obligatoire." },
      { status: 400 }
    );
  }

  const escapedEmail = escapeHtml(email);
  const escapedName = escapeHtml(name);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: "Nouvelle demande d'inscription Sage",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e3a2e;">
          <h1>Nouvelle demande d'inscription</h1>
          <p>Un enseignant vient de créer un compte sur Sage.</p>
          <ul>
            <li><strong>Nom affiché :</strong> ${escapedName}</li>
            <li><strong>Email :</strong> ${escapedEmail}</li>
          </ul>
          <p>Pour valider l'accès :</p>
          <ol>
            <li>Ouvrir Supabase.</li>
            <li>Aller dans <strong>Table Editor</strong> puis <strong>user_access</strong>.</li>
            <li>Passer le statut de <strong>pending</strong> à <strong>approved</strong>.</li>
          </ol>
        </div>
      `,
      text: `Nouvelle demande d'inscription Sage\n\nNom affiché : ${name}\nEmail : ${email}\n\nPour valider l'accès : Supabase > Table Editor > user_access > passer status de pending à approved.`
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ sent: false, error }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
