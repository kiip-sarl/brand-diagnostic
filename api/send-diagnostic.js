// Route Vercel Function : POST /api/send-diagnostic
//
// Reçoit le diagnostic (secteur, profil, score, indicateurs, réponses détaillées,
// PDF en base64 généré côté client) et l'envoie par email à kenny@kiip.ch via
// Resend, avec le PDF en pièce jointe. (Le parcours ne demande plus l'email du
// participant — s'il est fourni par un appelant, il est aussi utilisé.)
//
// La clé RESEND_API_KEY reste exclusivement côté serveur (variable d'environnement
// Vercel) — jamais exposée au navigateur. Aucune dépendance npm requise : cette
// fonction appelle directement l'API HTTP de Resend avec fetch (disponible
// nativement dans le runtime Node.js de Vercel).
//
// Déploiement : ce fichier vit dans /api à la racine du projet Vercel — la route
// /api/send-diagnostic est créée automatiquement au déploiement, aucune
// configuration supplémentaire n'est nécessaire au-delà de la variable
// d'environnement RESEND_API_KEY (Project Settings → Environment Variables).

const KENNY_EMAIL = 'kenny@kiip.ch';
const FROM_ADDRESS = 'Kiip. <diagnostic@kiip.ch>'; // doit utiliser votre domaine vérifié dans Resend

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'RESEND_API_KEY manquante côté serveur' });
    return;
  }

  const {
    participantEmail,
    sector,
    profileName,
    score,
    desirDifferenciation,
    memorisationPresence,
    reachatRelation,
    reponses,
    pdfBase64,
    pdfFilename
  } = req.body || {};

  if (!profileName) {
    res.status(400).json({ error: 'profileName manquant' });
    return;
  }

  const hasParticipantEmail = participantEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participantEmail);

  const attachments = [];
  if (pdfBase64) {
    attachments.push({
      filename: pdfFilename || 'Diagnostic personnalisé - Kiip.pdf',
      content: pdfBase64
    });
  }

  const summaryHtml = `
    <p><strong>Secteur :</strong> ${escapeHtml(sector || 'Non renseigné')}</p>
    <p><strong>Profil obtenu :</strong> ${escapeHtml(profileName)}</p>
    <p><strong>Score global :</strong> ${escapeHtml(score || '—')}</p>
    <p><strong>Désir &amp; différenciation :</strong> ${escapeHtml(desirDifferenciation || '—')}</p>
    <p><strong>Mémorisation &amp; présence :</strong> ${escapeHtml(memorisationPresence || '—')}</p>
    <p><strong>Réachat &amp; relation durable :</strong> ${escapeHtml(reachatRelation || '—')}</p>
  `;

  const participantHtml = `
    <div style="font-family:sans-serif;line-height:1.6;color:#141414;max-width:560px;">
      <h2 style="margin:0 0 16px;">Votre diagnostic de marque — Kiip.</h2>
      <p>Merci d'avoir complété le diagnostic. Votre profil obtenu est <strong>${escapeHtml(profileName)}</strong>.</p>
      <p>Vous trouverez votre rapport complet en pièce jointe.</p>
      <p style="margin-top:24px;">
        <a href="https://cal.com/kenny-cretin-kiip/premier-echange?user=kenny-cretin-kiip&amp;layout=mobile"
           style="color:#141414;font-weight:600;">Parler de mon projet avec Kiip →</a>
      </p>
      <p style="margin-top:28px;font-style:italic;color:#666;">— L'équipe Kiip</p>
    </div>
  `;

  const internalHtml = `
    <div style="font-family:sans-serif;line-height:1.6;color:#141414;max-width:560px;">
      <h2 style="margin:0 0 16px;">Nouveau diagnostic de marque</h2>
      ${hasParticipantEmail ? `<p><strong>Email du participant :</strong> ${escapeHtml(participantEmail)}</p>` : ''}
      ${summaryHtml}
      <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
      <p><strong>Réponses détaillées :</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;">${escapeHtml(reponses || '')}</pre>
    </div>
  `;

  try {
    const sends = [
      sendResendEmail(RESEND_API_KEY, {
        from: FROM_ADDRESS,
        to: [KENNY_EMAIL],
        subject: 'Nouveau diagnostic de marque – ' + profileName,
        html: internalHtml,
        attachments
      })
    ];
    if (hasParticipantEmail) {
      sends.push(sendResendEmail(RESEND_API_KEY, {
        from: FROM_ADDRESS,
        to: [participantEmail],
        subject: 'Votre diagnostic de marque – ' + profileName,
        html: participantHtml,
        attachments
      }));
    }

    const results = await Promise.all(sends);
    const failed = results.find(r => !r.ok);
    if (failed) {
      res.status(502).json({ error: "Resend a refusé l'envoi", details: failed.body });
      return;
    }

    res.status(200).json({ ok: true, success: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur inconnue' });
  }
};

async function sendResendEmail(apiKey, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const ok = r.ok;
  const body = ok ? null : await r.text();
  return { ok, body };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
