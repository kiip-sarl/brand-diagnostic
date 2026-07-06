const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const data = req.body || {};

    const html = `
      <h2>Nouveau diagnostic de marque</h2>
      <p><strong>Secteur :</strong> ${data.sector || 'Non renseigné'}</p>
      <p><strong>Profil :</strong> ${data.profileName || 'Non renseigné'}</p>
      <p><strong>Score :</strong> ${data.score || 'Non renseigné'}</p>
      <p><strong>ADN de marque :</strong> ${data.adnMarque || 'Non renseigné'}</p>
      <p><strong>Attachement émotionnel :</strong> ${data.attachementEmotionnel || 'Non renseigné'}</p>
      <p><strong>Potentiel d’extension :</strong> ${data.potentielExtension || 'Non renseigné'}</p>
      <pre>${data.reponses || ''}</pre>
    `;

    await resend.emails.send({
      from: 'Kiip Diagnostic <diagnostic@kiip.ch>',
      to: ['kenny@kiip.ch'],
      subject: data.subject || 'Nouveau diagnostic de marque',
      html
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur Resend:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};