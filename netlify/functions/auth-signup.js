const { Client } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { username, password } = JSON.parse(event.body);
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    const hash = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`,
      [username, hash]
    );
    return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Username already exists or error occurred" }) };
  } finally { await client.end(); }
};