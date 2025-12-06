const { Client } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { userId, score } = JSON.parse(event.body);
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    // This updates the score ONLY if the new one is higher than the old one
    await client.query(`
      INSERT INTO leaderboard (user_id, score) VALUES ($1, $2)
      ON CONFLICT (user_id) 
      DO UPDATE SET score = GREATEST(leaderboard.score, EXCLUDED.score), updated_at = NOW()
    `, [userId, score]);
    return { statusCode: 200, body: JSON.stringify({ message: "Saved" }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally { await client.end(); }
};
