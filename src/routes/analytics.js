const express = require('express');
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/analytics
 * Returns all aggregated analytics data in one call
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const [
      { data: bookings },
      { data: profiles },
      { data: reviews },
      { data: stats },
    ] = await Promise.all([
      supabase.from('bookings').select('status, service_category, service_type, created_at, rate_amount'),
      supabase.from('profiles').select('account_type, profession_specialty, handyman_specialty, is_verified, created_at'),
      supabase.from('reviews').select('rating, created_at'),
      supabase.from('pro_stats').select('earnings, jobs, rating'),
    ]);

    // --- Bookings by status ---
    const statusMap = {};
    (bookings ?? []).forEach((b) => {
      statusMap[b.status] = (statusMap[b.status] ?? 0) + 1;
    });
    const bookingsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    // --- Bookings by category ---
    const catMap = {};
    (bookings ?? []).forEach((b) => {
      catMap[b.service_category] = (catMap[b.service_category] ?? 0) + 1;
    });
    const bookingsByCategory = Object.entries(catMap).map(([category, count]) => ({ category, count }));

    // --- Top services ---
    const serviceMap = {};
    (bookings ?? []).forEach((b) => {
      serviceMap[b.service_type] = (serviceMap[b.service_type] ?? 0) + 1;
    });
    const topSpecialties = Object.entries(serviceMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([specialty, count]) => ({ specialty, count }));

    // --- Professionals by type ---
    const typeMap = {};
    (profiles ?? []).forEach((p) => {
      typeMap[p.account_type] = (typeMap[p.account_type] ?? 0) + 1;
    });
    const prosByType = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

    // --- Monthly booking trend (last 12 months) ---
    const monthMap = {};
    (bookings ?? []).forEach((b) => {
      const d = new Date(b.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] ?? 0) + 1;
    });
    const monthlyBookings = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }),
        count,
      }));

    // --- Monthly revenue trend ---
    const revenueMap = {};
    (bookings ?? []).forEach((b) => {
      if (b.status === 'completed' && b.rate_amount) {
        const d = new Date(b.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        revenueMap[key] = (revenueMap[key] ?? 0) + Number(b.rate_amount);
      }
    });
    const monthlyRevenue = Object.entries(revenueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, total]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }),
        total,
      }));

    // --- Rating distribution ---
    const ratingMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (reviews ?? []).forEach((r) => {
      if (ratingMap[r.rating] !== undefined) ratingMap[r.rating]++;
    });
    const ratingDistribution = Object.entries(ratingMap).map(([star, count]) => ({
      star: Number(star),
      count,
    }));

    const avgRating =
      reviews && reviews.length > 0
        ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1))
        : 0;

    // --- Pro verification rate ---
    const totalPros = (profiles ?? []).length;
    const verifiedPros = (profiles ?? []).filter((p) => p.is_verified).length;

    // --- Financial summary ---
    const totalEarnings = (stats ?? []).reduce((s, r) => s + Number(r.earnings ?? 0), 0);
    const totalJobs = (stats ?? []).reduce((s, r) => s + Number(r.jobs ?? 0), 0);

    res.json({
      success: true,
      data: {
        bookingsByStatus,
        bookingsByCategory,
        topSpecialties,
        prosByType,
        monthlyBookings,
        monthlyRevenue,
        ratingDistribution,
        avgRating,
        totalEarnings,
        totalJobs,
        verificationRate: totalPros > 0 ? parseFloat(((verifiedPros / totalPros) * 100).toFixed(1)) : 0,
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to load analytics.' });
  }
});

module.exports = router;
