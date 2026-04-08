const express = require('express');
const router = express.Router();
const db = require('../config/db');

// POST /api/webhooks/pandadoc
router.post('/pandadoc', async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const documentId = event.data?.id;
      const eventType = event.event;

      if (!documentId) continue;

      // Find the host with this pandadoc document
      const host = await db.query(
        'SELECT id FROM hosts WHERE pandadoc_document_id = $1',
        [documentId]
      );

      if (host.rows.length === 0) continue;

      const hostId = host.rows[0].id;

      switch (eventType) {
        case 'recipient_completed':
          // Host has signed — awaiting Dean
          await db.query(
            `UPDATE hosts SET agreement_status = 'host_signed' WHERE id = $1`,
            [hostId]
          );
          break;

        case 'document_state_changed':
          if (event.data?.status === 'document.completed') {
            // Fully executed
            await db.query(
              `UPDATE hosts SET
                agreement_status = 'executed',
                agreement_executed_date = NOW(),
                agreement_doc_url = $1
              WHERE id = $2`,
              [event.data?.download_url || null, hostId]
            );
          }
          break;
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('PandaDoc webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
