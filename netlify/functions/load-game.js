const { Client } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { userId } = JSON.parse(event.body);
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    const result = await client.query(`SELECT game_state FROM leaderboard WHERE user_id = $1`, [userId]);
    if (result.rows.length === 0 || !result.rows[0].game_state) {
        return { statusCode: 404, body: JSON.stringify({ error: "No save found" }) };
    }
    return { statusCode: 200, body: JSON.stringify({ gameState: result.rows[0].game_state }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally { await client.end(); }
};