const connect = require('../config/Mysqlcon');
const { creditWallet, InsufficientBalanceError } = require('../services/balanceService');

// GET /admin/withdrawals
exports.getWithdrawals = async (req, res) => {
  let conn;
  try {
    const pool = await connect();
    conn = await pool.getConnection();
    const { status: filterStatus, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT w.*, u.first_name, u.last_name, u.email FROM tbl_withdraw w LEFT JOIN dbt_user u ON w.user_id = u.user_id';
    const params = [];
    if (filterStatus) {
      query += ' WHERE w.status = ?'; params.push(filterStatus);
    }
    query += ' ORDER BY w.date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await conn.query(query, params);
    res.json({ status: 1, withdrawals: rows });
  } catch (err) {
    console.error('admin get withdrawals error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  } finally {
    if (conn) conn.release();
  }
};

// PATCH /admin/withdrawal/:id/approve
exports.approveWithdrawal = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [withdrawals] = await conn.query("SELECT * FROM tbl_withdraw WHERE id = ? AND status = 'pending'", [id]);
    if (!withdrawals.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ status: 0, message: 'Pending withdrawal not found.' });
    }

    await conn.query("UPDATE tbl_withdraw SET status = 'completed' WHERE id = ?", [id]);
    await conn.commit();
    conn.release();

    res.json({ status: 1, message: 'Withdrawal approved.' });
  } catch (err) {
    if (conn) { await conn.rollback(); conn.release(); }
    console.error('admin approve withdrawal error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};

// PATCH /admin/withdrawal/:id/reject
exports.rejectWithdrawal = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [withdrawals] = await conn.query("SELECT * FROM tbl_withdraw WHERE id = ? AND status = 'pending'", [id]);
    if (!withdrawals.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ status: 0, message: 'Pending withdrawal not found.' });
    }

    const wd = withdrawals[0];
    const refundAmount = parseFloat(wd.amount);
    const refundFee = parseFloat(wd.charge || 0);

    await creditWallet(conn, {
      user_id: wd.user_id,
      currency_symbol: wd.currency,
      walletType: 'spot',
      amount: refundAmount,
      fees: 0,
      transaction_type: 'WITHDRAW_REJECTED_REFUND',
      ip: req.ip,
    });

    // If fee was also deducted, refund that too
    if (refundFee > 0) {
      await creditWallet(conn, {
        user_id: wd.user_id,
        currency_symbol: wd.currency,
        walletType: 'spot',
        amount: refundFee,
        fees: 0,
        transaction_type: 'WITHDRAW_REJECTED_REFUND',
        ip: req.ip,
      });
    }

    await conn.query("UPDATE tbl_withdraw SET status = 'rejected', message = CONCAT(COALESCE(message,''), ' | Rejected by admin') WHERE id = ?", [id]);

    await conn.commit();
    conn.release();

    const io = req.app.get('io');
    if (io) io.to(`user_${wd.user_id}`).emit('balance_update', { user_id: wd.user_id });

    res.json({ status: 1, message: 'Withdrawal rejected and amount refunded.' });
  } catch (err) {
    if (conn) { await conn.rollback(); conn.release(); }
    if (err instanceof InsufficientBalanceError) {
      return res.status(400).json({ status: 0, message: err.message });
    }
    console.error('admin reject withdrawal error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};
