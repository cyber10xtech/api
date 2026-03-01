const express = require('express');
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/dashboard
 * Returns all stats needed for the admin dashboard in one request
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const [
      { count: totalProfessionals },
      { count: totalHandymen },
      { count: totalCustomers },
      { count: totalBookings },
      { count: pendingBookings },
      { count: completedBookings },
      { count: inProgressBookings },
      { count: pendingVerifications },
      { count: verifiedProfessionals },
      { data: reviews },
      { data: recentBookingsRaw },
      { data: topProsRaw },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'professional'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'handyman'),
      supabase.from('customer_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', false),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
      supabase.from('reviews').select('rating'),
      supabase
        .from('bookings')
        .select(`
          id, service_type, service_category, status, rate_amount, scheduled_date,
          customer:customer_profiles!customer_id(full_name),
          professional:profiles!professional_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('pro_stats')
        .select('pro_id, rating, jobs, earnings')
        .order('rating', { ascending: false })
        .limit(5),
    ]);

    const avgRating =
      reviews && reviews.length > 0
        ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1))
        : 0;

    // Enrich top pros with profile data
    const topPros = [];
    if (topProsRaw) {
      const proIds = topProsRaw.map((s) => s.pro_id);
      const { data: proProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, account_type, profession_specialty, handyman_specialty')
        .in('id', proIds);

      const proMap = {};
      proProfiles?.forEach((p) => (proMap[p.id] = p));

      topProsRaw.forEach((stat) => {
        const p = proMap[stat.pro_id];
        if (p) {
          topPros.push({
            id: p.id,
            full_name: p.full_name,
            account_type: p.account_type,
            profession_specialty: p.profession_specialty,
            handyman_specialty: p.handyman_specialty,
            rating: stat.rating ?? 0,
            jobs: stat.jobs ?? 0,
            earnings: stat.earnings ?? 0,
          });
        }
      });
    }

    // Flatten recent bookings
    const recentBookings = (recentBookingsRaw ?? []).map((b) => ({
      id: b.id,
      service_type: b.service_type,
      service_category: b.service_category,
      status: b.status,
      rate_amount: b.rate_amount,
      scheduled_date: b.scheduled_date,
      customer_name: b.customer?.full_name ?? 'Unknown',
      professional_name: b.professional?.full_name ?? 'Unknown',
    }));

    res.json({
      success: true,
      data: {
        stats: {
          totalProfessionals: totalProfessionals ?? 0,
          totalHandymen: totalHandymen ?? 0,
          totalCustomers: totalCustomers ?? 0,
          totalBookings: totalBookings ?? 0,
          pendingBookings: pendingBookings ?? 0,
          completedBookings: completedBookings ?? 0,
          inProgressBookings: inProgressBookings ?? 0,
          pendingVerifications: pendingVerifications ?? 0,
          verifiedProfessionals: verifiedProfessionals ?? 0,
          avgRating,
        },
        recentBookings,
        topPros,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard data.' });
  }
});

module.exports = router;
