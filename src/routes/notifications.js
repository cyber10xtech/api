const express = require('express');
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/notifications/broadcast
 * Send a notification to all customers, all professionals, or a specific user
 * Body: { target: 'all_customers' | 'all_professionals' | 'user', user_id?, user_type?, title, message, type? }
 */
router.post('/broadcast', requireAuth, async (req, res) => {
  const { target, user_id, user_type, title, message, type = 'admin_broadcast' } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'title and message are required.' });
  }

  try {
    let recipients = [];

    if (target === 'all_customers') {
      const { data } = await supabase.from('customer_profiles').select('user_id');
      recipients = (data ?? []).map((c) => ({ user_id: c.user_id, user_type: 'customer' }));
    } else if (target === 'all_professionals') {
      const { data } = await supabase.from('profiles').select('user_id');
      recipients = (data ?? []).filter((p) => p.user_id).map((p) => ({ user_id: p.user_id, user_type: 'professional' }));
    } else if (target === 'user' && user_id && user_type) {
      recipients = [{ user_id, user_type }];
    } else {
      return res.status(400).json({
        success: false,
        error: 'target must be all_customers, all_professionals, or user (with user_id and user_type).',
      });
    }

    if (recipients.length === 0) {
      return res.json({ success: true, message: 'No recipients found.', sent: 0 });
    }

    const notifications = recipients.map((r) => ({
      user_id: r.user_id,
      user_type: r.user_type,
      type,
      title,
      message,
      read: false,
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw error;

    res.json({ success: true, message: `Notification sent to ${recipients.length} recipient(s).`, sent: recipients.length });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ success: false, error: 'Failed to send notification.' });
  }
});

/**
 * GET /api/notifications
 * Lists recent platform notifications (all users)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, user_type, type, title, message, read, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ success: true, data: data ?? [], total: (data ?? []).length });
  } catch (err) {
    console.error('Notifications list error:', err);
    res.status(500).json({ success: false, error: 'Failed to load notifications.' });
  }
});

module.exports = router;
