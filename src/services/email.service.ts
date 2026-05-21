type WelcomeEmailInput = {
  to: string;
  name: string;
};

const isSyntheticEmail = (email: string) =>
  email.endsWith("@paytranche.local") || email.endsWith("@auth.paytranche.local");

class EmailService {
  private get senderEmail() {
    return process.env.EMAIL_FROM || "";
  }

  private get senderName() {
    return process.env.EMAIL_FROM_NAME || "PayTranche";
  }

  private get frontendUrl() {
    return process.env.FRONTEND_URL || "https://payetranche-vue-js.vercel.app";
  }

  private isEnabled() {
    return Boolean(process.env.BREVO_API_KEY && this.senderEmail);
  }

  async sendWelcomeEmail(input: WelcomeEmailInput) {
    if (!input.to || isSyntheticEmail(input.to) || !this.isEnabled()) {
      return;
    }

    try {
      const htmlContent = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Bienvenue sur PayTranche</h2>
          <p>Bonjour ${input.name || "cher utilisateur"},</p>
          <p>Votre compte PayTranche est créé. Vous pouvez maintenant enregistrer vos ventes à crédit, suivre les tranches et garder l'historique des paiements reçus.</p>
          <p>
            <a href="${this.frontendUrl}/dashboard" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">
              Ouvrir PayTranche
            </a>
          </p>
          <p style="font-size:13px;color:#64748b">Si vous n'êtes pas à l'origine de ce compte, ignorez simplement cet email.</p>
        </div>
      `;

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY || "",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: this.senderName,
            email: this.senderEmail,
          },
          to: [{ email: input.to, name: input.name }],
          subject: "Votre compte PayTranche est créé",
          htmlContent,
          textContent: `Bonjour ${input.name || ""}, votre compte PayTranche est créé. Ouvrez votre espace ici: ${this.frontendUrl}/dashboard`,
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        console.warn("Welcome email not sent:", details);
      }
    } catch (error) {
      console.warn("Welcome email not sent:", error);
    }
  }
}

export const emailService = new EmailService();
