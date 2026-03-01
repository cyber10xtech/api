const express = require('express');
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reviews
 * Query params: ?rating=1-5, ?professional_id=uuid
 * Returns enriched reviews with customer and professional names
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rating, professional_id, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('reviews')
      .select(`
        id, rating, comment, created_at,
        customer:customer_profiles!customer_id(id, full_name, avatar_url),
        professional:profiles!professional_id(id, full_name, profession_specialty, handyman_specialty),
        booking:bookings!booking_id(service_type, service_category)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (rating) query = query.eq('rating', Number(rating));
    if (professional_id) query = query.eq('professional_id', professional_id);

    const { data, error } = await query;
    if (error) throw error;

    // Compute summary stats
    const all = data ?? [];
    const avgRating = all.length > 0
      ? parseFloat((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1))
      : 0;

    const distribution = [5, 4, 3, 2, 1].map((s) => ({
      star: s,
      count: all.filter((r) => r.rating === s).length,
    }));

    const flattened = all.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      customer_id: r.customer?.id,
      customer_name: r.customer?.full_name ?? 'Unknown',
      customer_avatar: r.customer?.avatar_url,
      professional_id: r.professional?.id,
      professional_name: r.professional?.full_name ?? 'Unknown',
      professional_specialty:
        r.professional?.profession_specialty ?? r.professional?.handyman_specialty,
      service_type: r.booking?.service_type ?? '—',
      service_category: r.booking?.service_category,
    }));

    res.json({
      success: true,
      data: flattened,
      total: flattened.length,
      summary: { avgRating, distribution },
    });
  } catch (err) {
    console.error('Reviews list error:', err);
    res.status(500).json({ success: false, error: 'Failed to load reviews.' });
  }
});

/**
 * DELETE /api/reviews/:id
 * Admin can remove a review
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete review.' });
  }
});

module.exports = router;
