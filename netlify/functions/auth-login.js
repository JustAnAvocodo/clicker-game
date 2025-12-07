const { Client } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { username, password } = JSON.parse(event.body);
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    const result = await client.query(`SELECT * FROM users WHERE username = $1`, [username]);
    if (result.rows.length === 0) return { statusCode: 401, body: JSON.stringify({ error: "User not found" }) };
    
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return { statusCode: 401, body: JSON.stringify({ error: "Wrong password" }) };

    return { statusCode: 200, body: JSON.stringify({ id: result.rows[0].id, username: result.rows[0].username }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally { await client.end(); }
};