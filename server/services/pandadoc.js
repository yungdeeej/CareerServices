// PandaDoc service — handles agreement creation and sending
// In mock mode, simulates the PandaDoc API

const isMock = () => process.env.INTEGRATION_MODE !== 'live';

async function sendAgreement(host) {
  if (isMock()) {
    console.log(`[MOCK] PandaDoc agreement sent to ${host.contact_email} for ${host.org_name}`);
    return {
      documentId: `mock-doc-${Date.now()}`,
      status: 'sent',
    };
  }

  // Live PandaDoc integration
  const apiKey = process.env.PANDADOC_API_KEY;
  const response = await fetch('https://api.pandadoc.com/public/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `API-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Site Agreement - ${host.org_name}`,
      template_uuid: process.env.PANDADOC_TEMPLATE_ID,
      recipients: [
        {
          email: host.contact_email,
          first_name: host.contact_name?.split(' ')[0] || '',
          last_name: host.contact_name?.split(' ').slice(1).join(' ') || '',
          role: 'Host Contact',
          signing_order: 1,
        },
        {
          email: 'dj.gupta@mcgcollege.com',
          first_name: 'DJ',
          last_name: 'Gupta',
          role: 'MCG Dean',
          signing_order: 2,
        },
      ],
      fields: {
        org_name: { value: host.org_name },
        contact_name: { value: host.contact_name || '' },
        contact_email: { value: host.contact_email || '' },
        programs: { value: (host.programs_accepted || []).join(', ') },
        agreement_date: { value: new Date().toISOString().split('T')[0] },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`PandaDoc API error: ${JSON.stringify(data)}`);
  }

  // Send the document for signing
  await fetch(`https://api.pandadoc.com/public/v1/documents/${data.id}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `API-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Please review and sign the MCG Career College Site Agreement.',
      silent: false,
    }),
  });

  return {
    documentId: data.id,
    status: 'sent',
  };
}

module.exports = { sendAgreement };
