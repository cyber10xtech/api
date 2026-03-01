const express = require('express');
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

/**
 * GET /api/bookings
 * Query params: ?status=pending|confirmed|in_progress|completed|cancelled
 *               ?service_category=professional|handyman
 *               ?search=text
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, service_category, search, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('bookings')
      .select(`
        id, service_type, service_category, status, rate_amount, rate_type,
        scheduled_date, scheduled_time, description, notes, duration, created_at, updated_at,
        customer:customer_profiles!customer_id(id, full_name, email, phone, avatar_url),
        professional:profiles!professional_id(id, full_name, account_type, profession_specialty, handyman_specialty, location, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (service_category) query = query.eq('service_category', service_category);

    const { data, error } = await query;
    if (error) throw error;

    let results = data ?? [];

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (b) =>
          b.service_type.toLowerCase().includes(q) ||
          (b.customer?.full_name ?? '').toLowerCase().includes(q) ||
          (b.professional?.full_name ?? '').toLowerCase().includes(q)
      );
    }

    // Flatten nested objects for API consumers
    const flattened = results.map((b) => ({
      id: b.id,
      service_type: b.service_type,
      service_category: b.service_category,
      status: b.status,
      rate_amount: b.rate_amount,
      rate_type: b.rate_type,
      scheduled_date: b.scheduled_date,
      scheduled_time: b.scheduled_time,
      description: b.description,
      notes: b.notes,
      duration: b.duration,
      created_at: b.created_at,
      updated_at: b.updated_at,
      customer_id: b.customer?.id,
      customer_name: b.customer?.full_name ?? 'Unknown',
      customer_email: b.customer?.email,
      customer_phone: b.customer?.phone,
      customer_avatar: b.customer?.avatar_url,
      professional_id: b.professional?.id,
      professional_name: b.professional?.full_name ?? 'Unknown',
      professional_type: b.professional?.account_type,
      professional_specialty:
        b.professional?.profession_specialty ?? b.professional?.handyman_specialty,
      professional_location: b.professional?.location,
      professional_avatar: b.professional?.avatar_url,
    }));

    res.json({ success: true, data: flattened, total: flattened.length });
  } catch (err) {
    console.error('Bookings list error:', err);
    res.status(500).json({ success: false, error: 'Failed to load bookings.' });
  }
});

/**
 * GET /api/bookings/:id
 * Returns full booking details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customer_profiles!customer_id(*),
        professional:profiles!professional_id(*),
        reviews(id, rating, comment, created_at)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Booking not found.' });

    res.json({ success: true, data });
  } catch (err) {
    console.error('Booking detail error:', err);
    res.status(500).json({ success: false, error: 'Failed to load booking.' });
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Body: { status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' }
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, status, service_type, updated_at')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Booking marked as ${status}.`,
      data,
    });
  } catch (err) {
    console.error('Update booking status error:', err);
    res.status(500).json({ success: false, error: 'Failed to update booking status.' });
  }
});

/**
 * DELETE /api/bookings/:id
 * Admin-level delete of a booking
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('bookings').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Booking deleted.' });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete booking.' });
  }
});

module.exports = router;
