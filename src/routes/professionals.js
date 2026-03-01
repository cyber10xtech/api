const express = require('express');
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/professionals
 * Query params: ?account_type=professional|handyman, ?verified=true|false, ?search=name
 * Returns all professionals/handymen with their stats
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { account_type, verified, search, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('profiles')
      .select(`
        id, full_name, account_type, profession_specialty, handyman_specialty,
        location, is_verified, documents_uploaded, created_at, bio,
        daily_rate, hourly_rate, project_rate, contract_rate,
        years_experience, professional_license, service_radius_km, skills,
        pro_stats!inner(rating, jobs, earnings, views)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (account_type) query = query.eq('account_type', account_type);
    if (verified !== undefined) query = query.eq('is_verified', verified === 'true');

    const { data, error, count } = await query;
    if (error) throw error;

    let results = data ?? [];

    // Search filter (done in memory since Supabase ilike doesn't work across OR easily with RLS bypass)
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          (p.profession_specialty ?? '').toLowerCase().includes(q) ||
          (p.handyman_specialty ?? '').toLowerCase().includes(q) ||
          (p.location ?? '').toLowerCase().includes(q)
      );
    }

    // Flatten pro_stats
    const flattened = results.map((p) => {
      const stats = Array.isArray(p.pro_stats) ? p.pro_stats[0] : p.pro_stats;
      return {
        ...p,
        rating: stats?.rating ?? 0,
        jobs: stats?.jobs ?? 0,
        earnings: stats?.earnings ?? 0,
        views: stats?.views ?? 0,
        pro_stats: undefined,
      };
    });

    res.json({ success: true, data: flattened, total: flattened.length });
  } catch (err) {
    console.error('Professionals list error:', err);
    res.status(500).json({ success: false, error: 'Failed to load professionals.' });
  }
});

/**
 * GET /api/professionals/:id
 * Returns full profile of a single professional
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        pro_stats(rating, jobs, earnings, views),
        profiles_private(phone_number, whatsapp_number)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Professional not found.' });

    res.json({ success: true, data });
  } catch (err) {
    console.error('Professional detail error:', err);
    res.status(500).json({ success: false, error: 'Failed to load professional.' });
  }
});

/**
 * PATCH /api/professionals/:id/verify
 * Body: { is_verified: boolean }
 * Verify or revoke a professional
 */
router.patch('/:id/verify', requireAuth, async (req, res) => {
  const { is_verified } = req.body;
  if (typeof is_verified !== 'boolean') {
    return res.status(400).json({ success: false, error: 'is_verified must be a boolean.' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_verified, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, full_name, is_verified')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: is_verified ? 'Professional verified.' : 'Verification revoked.',
      data,
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, error: 'Failed to update verification.' });
  }
});

/**
 * DELETE /api/professionals/:id
 * Permanently removes a professional profile
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Professional deleted.' });
  } catch (err) {
    console.error('Delete professional error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete professional.' });
  }
});

module.exports = router;
