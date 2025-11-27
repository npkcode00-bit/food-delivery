// app/api/rider/route.js
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { Order } from '../../models/Order';
import { User } from '../../models/User';

export const runtime = 'nodejs';

/* -------------------- DB CONNECT -------------------- */

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

/* -------------------- HELPERS -------------------- */

function getRiderKeyFromSession(user) {
  return user?.id || user?._id || user?.email || null;
}

function userIsAdmin(user) {
  return (
    user?.role === 'admin' ||
    user?.role === 'superadmin' ||
    user?.admin === true
  );
}

function userIsRider(user) {
  return user?.role === 'rider' || user?.rider === true;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function getSessionUser() {
  const session = await getServerSession(authOptions);

  if (process.env.NODE_ENV !== 'production') {
    console.log('SESSION in /api/rider:', JSON.stringify(session, null, 2));
  }

  return session?.user || null;
}

/* ====================================================
 * GET /api/rider
 *  - Admin: { riders: [...], unassignedOrders: [...] }
 *  - Rider: { riders: [thisRider], unassignedOrders: [...] }
 * ==================================================== */

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const isAdmin = userIsAdmin(user);
    const isRider = userIsRider(user);

    if (!isAdmin && !isRider) {
      return json({ error: 'Forbidden' }, 403);
    }

    await dbConnect();

    // ============== ADMIN VIEW ==============
    if (isAdmin) {
      const riders = await User.find({
        $or: [{ role: 'rider' }, { rider: true }],
        archived: { $ne: true },
      })
        .select('_id name firstName lastName email rider role')
        .lean();

      const activeOrders = await Order.find({
        orderMethod: 'delivery',
        archived: { $ne: true },
        status: { $in: ['placed', 'in_kitchen', 'on_the_way'] },
      })
        .sort({ createdAt: 1 })
        .lean();

      const ordersByKey = {};
      for (const o of activeOrders) {
        const key = o.riderId || o.riderEmail;
        if (!key) continue;
        if (!ordersByKey[key]) ordersByKey[key] = [];
        ordersByKey[key].push(o);
      }

      const unassignedOrders = activeOrders.filter(
        (o) => !o.riderId && !o.riderEmail
      );

      const enrichedRiders = riders.map((r) => {
        const key = String(r._id) || r.email;
        const currentOrders = ordersByKey[key] || [];
        const name =
          r.name ||
          [r.firstName, r.lastName].filter(Boolean).join(' ') ||
          'Unnamed rider';

        return {
          _id: r._id,
          name,
          email: r.email || '',
          active: currentOrders.length > 0,
          currentOrders,
        };
      });

      return json({ riders: enrichedRiders, unassignedOrders });
    }

    // ============== RIDER VIEW ==============
    const riderKey = getRiderKeyFromSession(user);

    const myOrders = await Order.find({
      orderMethod: 'delivery',
      archived: { $ne: true },
      $or: [{ riderId: riderKey }, { riderEmail: user.email }],
    })
      .sort({ createdAt: 1 })
      .lean();

    const unassignedOrders = await Order.find({
      orderMethod: 'delivery',
      archived: { $ne: true },
      status: { $in: ['placed', 'in_kitchen'] },
      $or: [{ riderId: { $exists: false } }, { riderId: null }, { riderId: '' }],
      riderDeclined: { $ne: riderKey },
    })
      .sort({ createdAt: 1 })
      .lean();

    const thisRider = {
      _id: riderKey,
      name:
        user.name ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        'Me',
      email: user.email || '',
      active: myOrders.length > 0,
      currentOrders: myOrders,
    };

    return json({ riders: [thisRider], unassignedOrders });
  } catch (err) {
    console.error('Error in GET /api/rider:', err);
    return json({ error: 'Internal server error' }, 500);
  }
}

/* ====================================================
 * POST /api/rider
 *
 * Body:
 *  - { action: 'accept', orderId }
 *  - { action: 'decline', orderId }
 *  - { action: 'assign', orderId, riderId, riderName?, riderEmail? }  // admin
 *  - { action: 'unassign', orderId }                                   // admin/rider
 * ==================================================== */

export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, orderId } = body || {};

    if (!action || !orderId) {
      return json({ error: 'Missing action or orderId' }, 400);
    }

    await dbConnect();

    const isAdmin = userIsAdmin(user);
    const isRider = userIsRider(user);
    const riderKey = getRiderKeyFromSession(user);

    const order = await Order.findById(orderId);
    if (!order) {
      return json({ error: 'Order not found' }, 404);
    }

    // --- Rider accept ---
    if (action === 'accept') {
      if (!isAdmin && !isRider) {
        return json({ error: 'Forbidden' }, 403);
      }

      order.riderId = riderKey;
      order.riderEmail = user.email;
      order.riderName =
        user.name ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        order.riderName;

      if (!order.status || ['placed', 'in_kitchen'].includes(order.status)) {
        order.status = 'on_the_way';
      }

      await order.save();
      return json({ order: order.toObject() });
    }

    // --- Rider decline ---
    if (action === 'decline') {
      if (!isAdmin && !isRider) {
        return json({ error: 'Forbidden' }, 403);
      }

      order.riderDeclined = order.riderDeclined || [];
      if (riderKey && !order.riderDeclined.includes(riderKey)) {
        order.riderDeclined.push(riderKey);
      }

      if (order.riderId === riderKey) {
        order.riderId = undefined;
        order.riderEmail = undefined;
        order.riderName = undefined;
        if (order.status === 'on_the_way') {
          order.status = 'in_kitchen';
        }
      }

      await order.save();
      return json({ order: order.toObject() });
    }

    // --- Admin: assign order to rider ---
    if (action === 'assign') {
      if (!isAdmin) {
        return json({ error: 'Forbidden' }, 403);
      }

      const { riderId, riderName, riderEmail } = body;
      if (!riderId) {
        return json({ error: 'Missing riderId' }, 400);
      }

      order.riderId = riderId;
      order.riderName = riderName || order.riderName;
      order.riderEmail = riderEmail || order.riderEmail;

      if (!order.status || ['placed', 'in_kitchen'].includes(order.status)) {
        order.status = 'on_the_way';
      }

      await order.save();
      return json({ order: order.toObject() });
    }

    // --- Admin/Rider: unassign/remove from rider ---
    if (action === 'unassign') {
      const isAssignedToThisRider =
        order.riderId === riderKey || order.riderEmail === user.email;

      // Admin: can unassign any order
      // Rider: can only unassign orders assigned to themselves
      if (!isAdmin && !(isRider && isAssignedToThisRider)) {
        return json({ error: 'Forbidden' }, 403);
      }

      order.riderId = undefined;
      order.riderName = undefined;
      order.riderEmail = undefined;

      if (order.status === 'on_the_way') {
        order.status = 'in_kitchen';
      }

      await order.save();
      return json({ order: order.toObject() });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('Error in POST /api/rider:', err);
    return json({ error: 'Internal server error' }, 500);
  }
}
