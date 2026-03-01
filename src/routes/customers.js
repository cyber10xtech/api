const express = require('express');
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/customers
 * Returns all customers with their booking count
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('customer_profiles')
      .select('id, full_name, email, phone, whatsapp_number, city, address, zip_code, avatar_url, referral_code, referral_credits, created_at')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    let results = data ?? [];

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.city ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').includes(q)
      );
    }

    // Get booking counts for each customer
    const ids = results.map((c) => c.id);
    const { data: bookings } = await supabase
      .from('bookings')
      .select('customer_id')
      .in('customer_id', ids);

    const bookingCounts = {};
    (bookings ?? []).forEach((b) => {
      bookingCounts[b.customer_id] = (bookingCounts[b.customer_id] ?? 0) + 1;
    });

    const enriched = results.map((c) => ({
      ...c,
      bookings_count: bookingCounts[c.id] ?? 0,
    }));

    res.json({ success: true, data: enriched, total: enriched.length });
  } catch (err) {
    console.error('Customers list error:', err);
    res.status(500).json({ success: false, error: 'Failed to load customers.' });
  }
});

/**
 * GET /api/customers/:id
 * Returns a single customer with their bookings
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [{ data: customer, error }, { data: bookings }] = await Promise.all([
      supabase.from('customer_profiles').select('*').eq('id', req.params.id).single(),
      supabase.from('bookings').select('*').eq('customer_id', req.params.id).order('created_at', { ascending: false }),
    ]);

    if (error || !customer) return res.status(404).json({ success: false, error: 'Customer not found.' });

    res.json({ success: true, data: { ...customer, bookings: bookings ?? [] } });
  } catch (err) {
    console.error('Customer detail error:', err);
    res.status(500).json({ success: false, error: 'Failed to load customer.' });
  }
});

/**
 * DELETE /api/customers/:id
 * Removes a customer profile
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('customer_profiles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Customer deleted.' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete customer.' });
  }
});

module.exports = router;
