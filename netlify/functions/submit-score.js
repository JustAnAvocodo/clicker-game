const { Client } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { userId, score, gameState } = JSON.parse(event.body);
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    await client.query(`
      INSERT INTO leaderboard (user_id, score, game_state) VALUES ($1, $2, $3)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        score = GREATEST(leaderboard.score, EXCLUDED.score), 
        game_state = EXCLUDED.game_state,
        updated_at = NOW()
    `, [userId, score, gameState]);
    return { statusCode: 200, body: JSON.stringify({ message: "Saved" }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally { await client.end(); }
};