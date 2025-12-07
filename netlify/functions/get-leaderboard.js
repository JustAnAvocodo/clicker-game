const { Client } = require('@neondatabase/serverless');

exports.handler = async () => {
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    const result = await client.query(`
      SELECT u.username, l.score 
      FROM leaderboard l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.score DESC LIMIT 10
    `);
    return { statusCode: 200, body: JSON.stringify(result.rows) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally { await client.end(); }
};