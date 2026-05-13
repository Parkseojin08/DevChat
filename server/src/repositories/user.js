const pool = require('../db/db');

exports.findById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id, handle, email, name, bio, profile_image, birth_date
           FROM chatdata.users
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

exports.findByEmail = async (email) => {
    const { rows } = await pool.query(
        `SELECT id, handle, email, name, profile_image, password_hash
           FROM chatdata.users
          WHERE email = $1`,
        [email]
    );
    return rows[0] || null;
};

exports.findCredentialsById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id, handle, password_hash, refresh_token, profile_image
           FROM chatdata.users
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

exports.existsByHandle = async (handle) => {
    const { rowCount } = await pool.query(
        `SELECT 1 FROM chatdata.users WHERE handle = $1`,
        [handle]
    );
    return rowCount > 0;
};

exports.existsByEmail = async (email) => {
    const { rowCount } = await pool.query(
        `SELECT 1 FROM chatdata.users WHERE email = $1`,
        [email]
    );
    return rowCount > 0;
};

exports.insert = async ({ handle, email, name, password_hash, birth_date, profile_image }) => {
    const { rows } = await pool.query(
        `INSERT INTO chatdata.users (handle, email, name, password_hash, birth_date, profile_image)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, handle, email, name, birth_date, profile_image`,
        [handle, email, name, password_hash, birth_date, profile_image ?? null]
    );
    return rows[0];
};

exports.updateRefreshToken = async (id, refreshToken) => {
    await pool.query(
        `UPDATE chatdata.users SET refresh_token = $1, updated_at = NOW() WHERE id = $2`,
        [refreshToken ?? null, id]
    );
};

exports.updateProfile = async (id, { name, bio, profile_image, password_hash }) => {
    const { rows } = await pool.query(
        `UPDATE chatdata.users
            SET name          = COALESCE($1, name),
                bio           = COALESCE($2, bio),
                profile_image = COALESCE($3, profile_image),
                password_hash = COALESCE($4, password_hash),
                updated_at    = NOW()
          WHERE id = $5
       RETURNING id, handle, name, bio, profile_image`,
        [name ?? null, bio ?? null, profile_image ?? null, password_hash ?? null, id]
    );
    return rows[0] || null;
};

exports.deleteById = async (id) => {
    await pool.query(`DELETE FROM chatdata.users WHERE id = $1`, [id]);
};